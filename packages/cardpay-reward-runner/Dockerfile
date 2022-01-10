FROM python:3.9-slim
RUN mkdir /app
WORKDIR /app
ADD . .
RUN pip install -r requirements.txt
CMD ["python", "run_mock.py"]