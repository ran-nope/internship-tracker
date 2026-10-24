from sqlalchemy import Column, Integer, String, Date, Text, ForeignKey
from schema import Base


class UserDB(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, nullable=False)
    password = Column(String, nullable=False)


class InternshipDB(Base):
    __tablename__ = "internships"

    id = Column(Integer, primary_key=True, index=True)
    company = Column(String, nullable=False)
    role = Column(String, nullable=False)
    status = Column(String, nullable=False)
    application_date = Column(Date, nullable=False)
    user_id = Column(
        Integer,
        ForeignKey("users.id", name="fk_internships_user_id_users", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )

    location = Column(String, nullable=True)
    job_url = Column(String, nullable=True)
    notes = Column(Text, nullable=True)
