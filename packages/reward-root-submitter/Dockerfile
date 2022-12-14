
# build stage
FROM python:3.9 AS builder

# install PDM
RUN pip install -U pip setuptools wheel
RUN pip install pdm packaging==21.3
RUN pdm config python.use_venv false

# copy files
COPY pyproject.toml pdm.lock /project/
RUN pdm config python.use_venv false

# install dependencies
WORKDIR /project
RUN pdm install --prod --no-lock --no-editable


# run stage
FROM public.ecr.aws/lambda/python:3.9

# retrieve packages from build stage
ENV PYTHONPATH=${LAMBDA_TASK_ROOT}/pkgs
COPY --from=builder /project/__pypackages__/3.9/lib ${LAMBDA_TASK_ROOT}/pkgs
COPY abis ${LAMBDA_TASK_ROOT}/abis
COPY reward_root_submitter ${LAMBDA_TASK_ROOT}/reward_root_submitter
COPY pyproject.toml ${LAMBDA_TASK_ROOT}/pyproject.toml
COPY pdm.lock ${LAMBDA_TASK_ROOT}/pdm.lock
WORKDIR ${LAMBDA_TASK_ROOT}
# set command/entrypoint, adapt to fit your needs
CMD ["reward_root_submitter.lambda.handler"]
