# build stage
FROM python:3.9 AS builder

# install PDM
RUN pip install -U pip setuptools wheel
RUN pip install pdm

# copy files
COPY pyproject.toml pdm.lock /project/

# install dependencies
WORKDIR /project
RUN pdm install --prod --no-lock --no-editable


# run stage
FROM python:3.9-slim
RUN pip install future_fstrings
# retrieve packages from build stage
ENV PYTHONPATH=/project/pkgs
COPY --from=builder /project/__pypackages__/3.9/lib /project/pkgs
COPY . /project
WORKDIR /project

# set command/entrypoint, adapt to fit your needs
ARG rule
ENV RULE=$rule

ENTRYPOINT ["python", "-m", "cardpay_reward_programs.main"]