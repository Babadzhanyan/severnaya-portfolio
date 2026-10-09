FROM python:3.12-slim
WORKDIR /srv/pmo
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
COPY requirements.lock.txt ./
RUN pip install --no-cache-dir -r requirements.lock.txt && useradd --uid 10001 --create-home pmo
COPY app ./app
COPY data/live_config.json data/schema.json data/production_source_inputs.json data/production_example.json data/production_input_schema.json data/master_v65_source_audit.json ./data/
COPY schema.sql ./
USER pmo
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=45s CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/api/health', timeout=4)" || exit 1
CMD ["uvicorn", "app.main:create_app", "--factory", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]
