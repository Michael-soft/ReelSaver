FROM python:3.12-slim

# ffmpeg is required by yt-dlp for merging/audio extraction.
RUN apt-get update \
    && apt-get install -y --no-install-recommends ffmpeg \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY pyproject.toml ./
RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir .

COPY . .

ENV FLASK_APP=wsgi.py \
    FLASK_ENV=production \
    PORT=8000

EXPOSE 8000

CMD ["gunicorn", "--bind=0.0.0.0:8000", "--workers=2", "--timeout=120", "wsgi:app"]
