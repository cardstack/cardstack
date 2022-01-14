FROM python:3.9-slim


RUN mkdir /app
WORKDIR /app
ADD requirements.txt .
RUN pip install -r requirements.txt
ADD . .

ENTRYPOINT []
CMD ["python", "export.py"]