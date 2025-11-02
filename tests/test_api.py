"""Basic smoke tests for the API."""
import pytest
from fastapi.testclient import TestClient
from api.index import app

client = TestClient(app)


def test_root():
    """Test root endpoint."""
    response = client.get("/")
    assert response.status_code == 200
    assert "message" in response.json()


def test_health():
    """Test health endpoint."""
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "healthy"


def test_create_memory_endpoint_exists():
    """Test memory creation."""
    response = client.post(
        "/api/memories",
        json={"content": "Test memory content"}
    )
    # Should fail without proper setup, but endpoint should exist
    assert response.status_code in [200, 422, 500]  # 422 if validation fails, 500 if service fails


def test_search_endpoint_exists():
    """Test search endpoint exists."""
    response = client.get("/api/search?q=test")
    # Should fail without proper setup, but endpoint should exist
    assert response.status_code in [200, 422, 500]

