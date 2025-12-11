from supabase import create_client, Client
from pinecone import Pinecone
from neo4j import GraphDatabase
import cohere
from config import get_settings

settings = get_settings()

# Supabase
supabase: Client = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)

# Pinecone
pc = Pinecone(api_key=settings.PINECONE_API_KEY)
pinecone_index = pc.Index(settings.PINECONE_INDEX_NAME)

# Neo4j
neo4j_driver = None
if settings.NEO4J_URI and settings.NEO4J_USERNAME and settings.NEO4J_PASSWORD:
    neo4j_driver = GraphDatabase.driver(
        settings.NEO4J_URI, 
        auth=(settings.NEO4J_USERNAME, settings.NEO4J_PASSWORD)
    )

# Cohere
cohere_client = None
if settings.COHERE_API_KEY:
    cohere_client = cohere.Client(settings.COHERE_API_KEY)

def get_supabase():
    return supabase

def get_pinecone_index():
    return pinecone_index

def get_neo4j_driver():
    return neo4j_driver

def get_cohere_client():
    return cohere_client
