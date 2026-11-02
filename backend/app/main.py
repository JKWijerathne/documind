from fastapi import FastAPI

app = FastAPI(
    title="DocuMind API",
    description="AI-powered document assistant",
    version="1.0.0"
)


@app.get("/")
def home():
    return {
        "message": "Welcome to DocuMind API",
        "status": "running"
    }


@app.get("/health")
def health_check():
    return {
        "status": "healthy"
    }