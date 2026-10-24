"""Connection/session construction without .env loading or database connections."""
from sqlalchemy import create_engine, event
from sqlalchemy.engine import make_url
from sqlalchemy.orm import Session, sessionmaker


class ApplicationSession(Session):
    pass


@event.listens_for(ApplicationSession, 'after_begin')
def protect_maintenance_transaction(session, transaction, connection):
    if (not transaction.nested and session.info.get('maintenance_read_only', False)
            and connection.dialect.name == 'postgresql'):
        # Reapply on EVERY new transaction, including after commit/rollback.
        # SET TRANSACTION cannot leak into the next pool user's transaction.
        connection.exec_driver_sql('SET TRANSACTION READ ONLY')


def build_engine(url, runtime):
    options = {}
    if make_url(url).get_backend_name() == 'postgresql':
        options = {'connect_timeout': 10,
                   'application_name': f'internship-tracker/{runtime.release[:7]}/{runtime.instance_id}'}
    return create_engine(url, hide_parameters=True, pool_pre_ping=True, connect_args=options)


def build_session_factory(engine, maintenance_mode=False):
    return sessionmaker(class_=ApplicationSession, autocommit=False, autoflush=False,
                        bind=engine, info={'maintenance_read_only': maintenance_mode})
