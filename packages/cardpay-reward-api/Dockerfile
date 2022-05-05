
# build stage
FROM python:3.9

# install PDM
RUN pip install -U pip setuptools wheel
RUN pip install pdm

# copy files
COPY pyproject.toml pdm.lock /project/

# install dependencies
WORKDIR /project
RUN pdm install --prod --no-lock --no-editable

# retrieve packages from build stage
ENV PYTHONPATH=/project/__pypackages__/3.9/lib
COPY . /project
WORKDIR /project
# set command/entrypoint, adapt to fit your needs
CMD ["python", "-m", "cardpay_reward_api.main"]
