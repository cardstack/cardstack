
FROM python:3.9

RUN pip install -U pip setuptools wheel
RUN pip install pdm

COPY pyproject.toml pdm.lock /project/

WORKDIR /project
RUN pdm install --prod --no-lock --no-editable

ENV PYTHONPATH=/project/__pypackages__/3.9/lib
COPY . /project
WORKDIR /project

CMD ["python", "-m", "cardpay_reward_api.main"]
