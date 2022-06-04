#!/usr/bin/env python3
import os

from dotenv import load_dotenv
from fastapi_utils.session import FastAPISessionMaker
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

load_dotenv()


Base = declarative_base()
