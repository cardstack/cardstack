
# build stage
FROM --platform=linux/amd64 python:3.9

# install PDM
RUN pip install -U pip setuptools wheel
RUN pip install pdm

# copy files
COPY pyproject.toml pdm.lock /project/

# install dependencies
WORKDIR /project
RUN pdm install --prod --no-lock --no-editable
RUN ls

# run stage
RUN ls

# retrieve packages from build stage
RUN ls
COPY /project/__pypackages__/3.9/lib /project/pkgs
COPY . /project
WORKDIR /project
RUN ls

# set command/entrypoint, adapt to fit your needs
CMD ["uvicorn", "cardpay_reward_pai.main:app", "--host", "0.0.0.0", "--port", "80"]
