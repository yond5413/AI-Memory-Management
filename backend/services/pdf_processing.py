"""
PDF Processing Service - Smart section-based PDF parsing with LLM summarization.

Features:
- Intelligent section detection (headers, common section names, visual cues)
- Per-section LLM summarization
- Rate-limited processing integration
- Memory creation for each section
"""

import re
import json
import logging
from io import BytesIO
from typing import List, Dict, Any, Optional, Tuple
from dataclasses import dataclass
from pypdf import PdfReader

from database import get_cohere_client
from services.memory_service import MemoryService
from services.job_queue import get_rate_limiter, RateLimitedExecutor, JobStatus

logger = logging.getLogger(__name__)


@dataclass
class DocumentSection:
    """Represents a detected section in a document."""
    title: str
    content: str
    page_start: int
    page_end: int
    section_type: str  # e.g., 'education', 'experience', 'skills', 'general'
    

# Common section header patterns for various document types
SECTION_PATTERNS = [
    # CV/Resume sections
    (r'^(EDUCATION|Education|ACADEMIC BACKGROUND)[\s:]*$', 'education'),
    (r'^(EXPERIENCE|Experience|WORK EXPERIENCE|EMPLOYMENT|PROFESSIONAL EXPERIENCE)[\s:]*$', 'experience'),
    (r'^(SKILLS|Skills|TECHNICAL SKILLS|CORE COMPETENCIES)[\s:]*$', 'skills'),
    (r'^(PROJECTS|Projects|PERSONAL PROJECTS|KEY PROJECTS)[\s:]*$', 'projects'),
    (r'^(SUMMARY|Summary|PROFESSIONAL SUMMARY|PROFILE|OBJECTIVE)[\s:]*$', 'summary'),
    (r'^(CERTIFICATIONS?|Certifications?|LICENSES?)[\s:]*$', 'certifications'),
    (r'^(AWARDS?|Awards?|HONORS?|ACHIEVEMENTS?)[\s:]*$', 'awards'),
    (r'^(PUBLICATIONS?|Publications?)[\s:]*$', 'publications'),
    (r'^(LANGUAGES?|Languages?)[\s:]*$', 'languages'),
    (r'^(INTERESTS?|Interests?|HOBBIES)[\s:]*$', 'interests'),
    (r'^(CONTACT|Contact|CONTACT INFORMATION)[\s:]*$', 'contact'),
    (r'^(REFERENCES?|References?)[\s:]*$', 'references'),
    
    # Academic paper sections
    (r'^(ABSTRACT|Abstract)[\s:]*$', 'abstract'),
    (r'^(INTRODUCTION|Introduction)[\s:]*$', 'introduction'),
    (r'^(METHODOLOGY|Methodology|METHODS?|Methods?)[\s:]*$', 'methodology'),
    (r'^(RESULTS?|Results?)[\s:]*$', 'results'),
    (r'^(DISCUSSION|Discussion)[\s:]*$', 'discussion'),
    (r'^(CONCLUSION|Conclusion|CONCLUSIONS?)[\s:]*$', 'conclusion'),
    
    # General document sections (numbered or bulleted)
    (r'^(\d+\.?\s*[A-Z][A-Za-z\s]+)$', 'numbered_section'),
    (r'^([A-Z][A-Z\s]{2,})$', 'uppercase_header'),  # ALL CAPS headers
]


class PdfProcessingService:
    """
    Enhanced PDF processing with smart section detection and rate-limited LLM calls.
    """
    
    def __init__(self):
        self.cohere = get_cohere_client()
        self.memory_service = MemoryService()
        self.rate_limiter: RateLimitedExecutor = get_rate_limiter(delay_seconds=2.0)
        
    async def process_pdf_with_sections(
        self,
        file_content: bytes,
        filename: str,
        user_id: str,
        progress_callback: callable = None
    ) -> Dict[str, Any]:
        """
        Process PDF with smart section detection and per-section summarization.
        
        Args:
            file_content: Raw PDF bytes
            filename: Original filename
            user_id: User ID for memory storage
            progress_callback: Optional callback(processed, total) for progress
            
        Returns:
            Dict with sections and created memories
        """
        try:
            # 1. Extract text with page info
            pages_text = self._extract_pages_text(file_content)
            full_text = "\n".join(pages_text)
            
            # 2. Detect sections
            sections = self._detect_sections(pages_text)
            
            if not sections:
                # Fallback: treat entire document as one section
                sections = [DocumentSection(
                    title="Document Content",
                    content=full_text,
                    page_start=1,
                    page_end=len(pages_text),
                    section_type="general"
                )]
                
            logger.info(f"Detected {len(sections)} sections in {filename}")
            
            # 3. Summarize each section with rate limiting
            created_memories = []
            
            for i, section in enumerate(sections):
                # Rate-limited LLM summarization
                summary = await self.rate_limiter.execute(
                    self._summarize_section,
                    section
                )
                
                # Create memory from summary
                memory = await self.memory_service.add_long_term_memory(
                    user_id=user_id,
                    content=summary,
                    metadata={
                        "source": "pdf",
                        "filename": filename,
                        "section_title": section.title,
                        "section_type": section.section_type,
                        "page_start": section.page_start,
                        "page_end": section.page_end,
                        "original_content_preview": section.content[:200]
                    }
                )
                created_memories.append(memory)
                
                # Report progress
                if progress_callback:
                    progress_callback(i + 1, len(sections))
                    
            return {
                "sections_detected": len(sections),
                "memories_created": len(created_memories),
                "sections": [
                    {
                        "title": s.title,
                        "type": s.section_type,
                        "pages": f"{s.page_start}-{s.page_end}"
                    }
                    for s in sections
                ],
                "memory_ids": [m["id"] if m else None for m in created_memories]
            }
            
        except Exception as e:
            logger.error(f"Error processing PDF {filename}: {e}")
            raise
            
    def _extract_pages_text(self, file_content: bytes) -> List[str]:
        """Extract text from each page of the PDF."""
        reader = PdfReader(BytesIO(file_content))
        pages = []
        
        for page in reader.pages:
            text = page.extract_text() or ""
            pages.append(text)
            
        return pages
        
    def _detect_sections(self, pages_text: List[str]) -> List[DocumentSection]:
        """
        Detect document sections using pattern matching and heuristics.
        
        Strategies:
        1. Match known section header patterns
        2. Look for ALL CAPS lines (likely headers)
        3. Detect numbered sections (1., 2., etc.)
        4. Use line spacing/formatting cues
        """
        all_text = "\n".join(pages_text)
        lines = all_text.split("\n")
        
        # Find potential section headers
        headers: List[Tuple[int, str, str]] = []  # (line_idx, title, section_type)
        
        for i, line in enumerate(lines):
            line = line.strip()
            if not line or len(line) < 2:
                continue
                
            # Check against known patterns
            for pattern, section_type in SECTION_PATTERNS:
                if re.match(pattern, line):
                    headers.append((i, line, section_type))
                    break
            else:
                # Heuristic: Short lines in CAPS might be headers
                if (len(line) < 50 and 
                    line.isupper() and 
                    len(line.split()) <= 5 and
                    not line.isdigit()):
                    headers.append((i, line, "general"))
                    
        # Build sections from headers
        sections: List[DocumentSection] = []
        
        for i, (line_idx, title, section_type) in enumerate(headers):
            # Find content until next header or end
            if i + 1 < len(headers):
                next_line_idx = headers[i + 1][0]
                content_lines = lines[line_idx + 1:next_line_idx]
            else:
                content_lines = lines[line_idx + 1:]
                
            content = "\n".join(content_lines).strip()
            
            # Skip empty sections
            if not content or len(content) < 20:
                continue
                
            # Estimate page numbers (rough approximation)
            chars_per_page = len(all_text) / max(len(pages_text), 1)
            char_position = sum(len(l) for l in lines[:line_idx])
            page_start = int(char_position / chars_per_page) + 1
            
            end_char_position = char_position + len(content)
            page_end = int(end_char_position / chars_per_page) + 1
            
            sections.append(DocumentSection(
                title=title.strip(),
                content=content,
                page_start=min(page_start, len(pages_text)),
                page_end=min(page_end, len(pages_text)),
                section_type=section_type
            ))
            
        return sections
        
    async def _summarize_section(self, section: DocumentSection) -> str:
        """
        Use LLM to create a concise, memory-worthy summary of a section.
        """
        if not self.cohere:
            # Fallback: return truncated content
            return f"[{section.title}] {section.content[:300]}..."
            
        prompt = f"""Summarize the following document section into a clear, factual memory.
Focus on extracting key information that would be useful to remember about the person or topic.
Keep the summary concise but informative (2-4 sentences).

Section Title: {section.title}
Section Type: {section.section_type}

Content:
{section.content[:3000]}

Summary:"""

        try:
            response = self.cohere.chat(
                message=prompt,
                model="command-r-08-2024",
                temperature=0.3
            )
            return response.text.strip()
        except Exception as e:
            logger.error(f"LLM summarization failed for section '{section.title}': {e}")
            # Fallback
            return f"[{section.title}] {section.content[:300]}..."
            
    # --- Legacy method for backwards compatibility ---
    
    async def process_pdf(self, file_content: bytes, filename: str, user_id: str):
        """
        Legacy method - processes PDF using atomic extraction.
        Kept for backwards compatibility.
        """
        try:
            reader = PdfReader(BytesIO(file_content))
            text = ""
            for page in reader.pages:
                text += page.extract_text() + "\n"
            
            # Atomic Extraction via LLM
            atomic_segments = await self._extract_atomic_segments(text)
            
            created_memories = []
            for segment in atomic_segments:
                # Add to LTM
                mem = await self.memory_service.add_long_term_memory(
                    user_id=user_id,
                    content=segment['content'],
                    metadata={
                        "source": "pdf",
                        "filename": filename,
                        "type": segment.get('type', 'general'),
                        "original_text_snippet": text[:100]
                    }
                )
                created_memories.append(mem)
                
            return created_memories
            
        except Exception as e:
            logger.error(f"Error processing PDF: {e}")
            raise e

    async def _extract_atomic_segments(self, text: str) -> List[Dict[str, Any]]:
        """
        Legacy method - Use LLM to breakdown text into atomic segments.
        """
        if not self.cohere:
            # Fallback simple chunking
            return [{"type": "chunk", "content": chunk} for chunk in text.split('\n\n') if chunk.strip()]

        prompt = f"""
        Analyze the following document text and break it down into atomic facts/memories.
        Focus on extracting user details like Skills, Experience, Projects, Interests.
        Return a JSON array of objects with 'type' and 'content'.
        
        Text:
        {text[:4000]} 
        
        JSON:
        """
        
        try:
            response = self.cohere.chat(
                message=prompt,
                model="command-r-08-2024",
                temperature=0.0
            )
            
            # Parse JSON from response
            res_text = response.text
            # Basic cleanup if Markdown code blocks used
            if "```json" in res_text:
                res_text = res_text.split("```json")[1].split("```")[0]
            elif "```" in res_text:
                res_text = res_text.split("```")[1].split("```")[0]
            
            return json.loads(res_text.strip())
        except Exception as e:
            logger.error(f"LLM Extraction failed: {e}")
            # Fallback
            return [{"type": "raw_chunk", "content": text[:500]}]
