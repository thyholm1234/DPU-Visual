FROM python:3.11-slim

WORKDIR /app
COPY . /app

EXPOSE 8073

CMD ["python", "-m", "http.server", "8073"]
