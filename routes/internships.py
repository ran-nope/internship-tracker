from fastapi import Depends, HTTPException
from sqlalchemy.orm import Session
from models import InternshipDB
from fastapi import APIRouter, Query
from sqlalchemy import or_, func
from schemas import Internship
from auth import get_db, get_current_user, commit_internship
router = APIRouter()

# ---------------- VALIDATE INTERNSHIP ----------------

def validate_internship(internship: Internship):
    for field in ("company", "role", "status"):
        value = getattr(internship, field)

        if not value.strip():
            raise HTTPException(
                status_code=422,
                detail=f"{field.replace('_', ' ').title()} cannot be blank",
            )

    allowed_statuses = {
        "Applied",
        "Interview",
        "Rejected",
        "Selected",
        "Assessment",
        "Offer",
        "Withdrawn",
    }

    if internship.status not in allowed_statuses:
        raise HTTPException(
            status_code=422,
            detail="Invalid internship status",
        )


# ---------------- GET INTERNSHIPS ----------------

@router.get('/internships')
def get_internships(current_user: int = Depends(get_current_user), db: Session = Depends(get_db),
                    limit: int = Query(8, ge=1, le=100), offset: int = Query(0, ge=0),
                    search: str = Query('', max_length=200), status: str = '', sort: str = 'newest'):
    query = db.query(InternshipDB).filter(InternshipDB.user_id == current_user)
    if search.strip():
        term = '%' + search.strip().replace('\\', '\\\\').replace('%', '\\%').replace('_', '\\_') + '%'
        query = query.filter(or_(InternshipDB.company.ilike(term, escape='\\'), InternshipDB.role.ilike(term, escape='\\'), InternshipDB.location.ilike(term, escape='\\')))
    if status and status != 'All':
        query = query.filter(InternshipDB.status == status)
    total = query.count()
    if sort == 'oldest':
        query = query.order_by(InternshipDB.application_date.asc(), InternshipDB.id.asc())
    elif sort == 'company':
        query = query.order_by(func.lower(InternshipDB.company), InternshipDB.id.desc())
    else:
        query = query.order_by(InternshipDB.application_date.desc(), InternshipDB.id.desc())
    return {'items': query.offset(offset).limit(limit).all(), 'total': total, 'limit': limit, 'offset': offset}


@router.get('/internships/summary')
def summary(current_user: int = Depends(get_current_user), db: Session = Depends(get_db)):
    base = db.query(InternshipDB).filter(InternshipDB.user_id == current_user)
    counts = dict(base.with_entities(InternshipDB.status, func.count()).group_by(InternshipDB.status).all())
    total = sum(counts.values())
    statuses = ['Applied', 'Assessment', 'Interview', 'Offer', 'Selected', 'Rejected', 'Withdrawn']
    counts = {key: counts.get(key, 0) for key in statuses}
    # Aggregate by month in SQL; do not transfer every application for charts.
    year = func.extract('year', InternshipDB.application_date)
    month = func.extract('month', InternshipDB.application_date)
    months = [{'application_date': f'{int(y):04d}-{int(m):02d}-01', 'count': n}
              for y, m, n in base.with_entities(year, month, func.count()).group_by(year, month).all()]
    return {'total': total, 'counts': counts, 'active': sum(counts[s] for s in statuses[:4]),
            'selectionRate': f"{counts['Selected'] / total * 100:.1f}" if total else '0.0', 'months': months}


# ---------------- ADD INTERNSHIP ----------------

@router.post("/internships")
def add_internship(
    internship: Internship,
    current_user: int = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    validate_internship(internship)

    new_internship = InternshipDB(
        company=internship.company.strip(),
        role=internship.role.strip(),
        status=internship.status,
        application_date=internship.application_date,
        location=internship.location,
        job_url=internship.job_url,
        notes=internship.notes,
        user_id=current_user,
    )

    db.add(new_internship)
    commit_internship(db)
    db.refresh(new_internship)

    return new_internship


# ---------------- UPDATE INTERNSHIP ----------------

@router.put("/internships/{internship_id}")
def update_internship(
    internship_id: int,
    internship: Internship,
    current_user: int = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    validate_internship(internship)

    existing = (
        db.query(InternshipDB)
        .filter(
            InternshipDB.id == internship_id,
            InternshipDB.user_id == current_user,
        )
        .first()
    )

    if not existing:
        raise HTTPException(
            status_code=404,
            detail="Internship not found",
        )

    existing.company = internship.company.strip()
    existing.role = internship.role.strip()
    existing.status = internship.status
    existing.application_date = internship.application_date
    existing.location = internship.location
    existing.job_url = internship.job_url
    existing.notes = internship.notes

    commit_internship(db)
    db.refresh(existing)

    return existing


# ---------------- DELETE INTERNSHIP ----------------

@router.delete("/internships/{internship_id}")
def delete_internship(
    internship_id: int,
    current_user: int = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    existing = (
        db.query(InternshipDB)
        .filter(
            InternshipDB.id == internship_id,
            InternshipDB.user_id == current_user,
        )
        .first()
    )

    if not existing:
        raise HTTPException(
            status_code=404,
            detail="Internship not found",
        )

    db.delete(existing)
    commit_internship(db)

    return {"message": "Internship deleted successfully"}
