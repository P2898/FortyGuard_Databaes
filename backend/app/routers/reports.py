"""Compliance reports API — PDF + CSV generation with ReportLab."""

import io
import csv
from datetime import datetime
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional
from app.database import get_service_client, is_configured

router = APIRouter(prefix="/api/reports", tags=["reports"])


class ReportRequest(BaseModel):
    scope: str = "site"  # "site" or "company"
    site_id: str = ""
    date_range_start: str = ""
    date_range_end: str = ""


def _get_sites():
    if is_configured():
        sb = get_service_client()
        result = sb.table("sites").select("*").execute()
        return result.data or []
    from app.routers.sites import _sites
    return _sites


def _get_assessments(site_id: str = ""):
    if is_configured():
        sb = get_service_client()
        query = sb.table("risk_assessments").select("*")
        if site_id:
            query = query.eq("site_id", site_id)
        result = query.order("timestamp", desc=True).limit(100).execute()
        return result.data or []
    from app.routers.assessment import get_latest_assessments
    assessments = get_latest_assessments()
    if site_id:
        return [a for a in assessments if a.get("site_id") == site_id]
    return assessments


def _generate_pdf_report(site_name: str, site_id: str, assessments: list, scope: str) -> bytes:
    """Generate a compliance PDF report using ReportLab."""
    from reportlab.lib.pagesizes import letter
    from reportlab.lib.units import inch
    from reportlab.lib import colors
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer

    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=letter, topMargin=0.5*inch, bottomMargin=0.5*inch)
    styles = getSampleStyleSheet()
    elements = []

    # Title style
    title_style = ParagraphStyle('CustomTitle', parent=styles['Title'], fontSize=18, spaceAfter=20, textColor=colors.HexColor('#1B2A4A'))
    subtitle_style = ParagraphStyle('Subtitle', parent=styles['Normal'], fontSize=12, textColor=colors.HexColor('#64748b'), spaceAfter=10)
    header_style = ParagraphStyle('Header', parent=styles['Heading2'], fontSize=14, textColor=colors.HexColor('#1B2A4A'), spaceBefore=16, spaceAfter=8)

    # Header
    elements.append(Paragraph("Shade Heat Exposure Record", title_style))
    elements.append(Paragraph("Form SG-1 — Heat Safety Compliance Report", subtitle_style))
    elements.append(Spacer(1, 12))

    # Report metadata
    meta_data = [
        ["Scope", scope.title()],
        ["Site", f"{site_name} ({site_id})" if site_id else "All Sites (Company Rollup)"],
        ["Generated", datetime.now().strftime("%Y-%m-%d %H:%M UTC")],
        ["Powered by", "FortyGuard · 20m Resolution"],
    ]
    meta_table = Table(meta_data, colWidths=[1.5*inch, 4.5*inch])
    meta_table.setStyle(TableStyle([
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('TEXTCOLOR', (0, 0), (0, -1), colors.HexColor('#64748b')),
        ('TEXTCOLOR', (1, 0), (1, -1), colors.HexColor('#1B2A4A')),
        ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('LINEBELOW', (0, 0), (-1, -1), 0.5, colors.HexColor('#e2e8f0')),
    ]))
    elements.append(meta_table)
    elements.append(Spacer(1, 16))

    # Risk assessment summary
    elements.append(Paragraph("Risk Assessment Summary", header_style))

    if assessments:
        # Count risk buckets
        bucket_counts = {"CRITICAL": 0, "HIGH": 0, "MEDIUM": 0, "LOW": 0}
        for a in assessments:
            bucket = a.get("risk_bucket", "LOW")
            if bucket in bucket_counts:
                bucket_counts[bucket] += 1

        summary_data = [
            ["Risk Level", "Count", "Percentage"],
            ["CRITICAL", str(bucket_counts["CRITICAL"]),
             f"{bucket_counts['CRITICAL']/len(assessments)*100:.0f}%" if assessments else "0%"],
            ["HIGH", str(bucket_counts["HIGH"]),
             f"{bucket_counts['HIGH']/len(assessments)*100:.0f}%" if assessments else "0%"],
            ["MEDIUM", str(bucket_counts["MEDIUM"]),
             f"{bucket_counts['MEDIUM']/len(assessments)*100:.0f}%" if assessments else "0%"],
            ["LOW", str(bucket_counts["LOW"]),
             f"{bucket_counts['LOW']/len(assessments)*100:.0f}%" if assessments else "0%"],
        ]

        summary_table = Table(summary_data, colWidths=[2*inch, 1.5*inch, 1.5*inch])
        risk_colors = {
            "CRITICAL": colors.HexColor('#dc2626'),
            "HIGH": colors.HexColor('#ea580c'),
            "MEDIUM": colors.HexColor('#d97706'),
            "LOW": colors.HexColor('#16a34a'),
        }
        table_style = [
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#f1f5f9')),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 10),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#e2e8f0')),
            ('ALIGN', (1, 0), (-1, -1), 'CENTER'),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
            ('TOPPADDING', (0, 0), (-1, -1), 8),
        ]
        for i, bucket in enumerate(["CRITICAL", "HIGH", "MEDIUM", "LOW"], start=1):
            table_style.append(('TEXTCOLOR', (0, i), (0, i), risk_colors.get(bucket, colors.black)))
            table_style.append(('FONTNAME', (0, i), (0, i), 'Helvetica-Bold'))

        summary_table.setStyle(TableStyle(table_style))
        elements.append(summary_table)
        elements.append(Spacer(1, 16))

        # Detailed assessment table
        elements.append(Paragraph("Detailed Assessments", header_style))
        detail_data = [["Site ID", "Risk", "Temp °C", "Heat Idx", "Exceed h", "Persist h"]]
        for a in assessments[:20]:  # Limit to 20 rows
            detail_data.append([
                a.get("site_id", ""),
                a.get("risk_bucket", ""),
                str(a.get("temperature_c", "")),
                str(a.get("heat_index", "")),
                str(a.get("exceedance_hours", "")),
                str(a.get("persistence_hours", "")),
            ])

        detail_table = Table(detail_data, colWidths=[1.2*inch, 0.8*inch, 0.8*inch, 0.8*inch, 0.8*inch, 0.8*inch])
        detail_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#f1f5f9')),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 9),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#e2e8f0')),
            ('ALIGN', (1, 0), (-1, -1), 'CENTER'),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
            ('TOPPADDING', (0, 0), (-1, -1), 6),
        ]))
        elements.append(detail_table)
    else:
        elements.append(Paragraph("No assessment data available. Run a fleet assessment first.", styles['Normal']))

    elements.append(Spacer(1, 24))

    # Thresholds and sources
    elements.append(Paragraph("Thresholds & Sources", header_style))
    source_data = [
        ["Threshold", "Value", "Source"],
        ["NIOSH WBGT REL", "28°C / 82.4°F", "NIOSH Criteria Document"],
        ["OSHA Precaution", "80°F / 26.7°C", "OSHA Proposed Heat Rule (2024)"],
        ["OSHA Action", "90°F / 32.2°C", "OSHA Proposed Heat Rule (2024)"],
        ["CA Indoor Heat", "82°F / 27.8°C", "Cal/OSHA Title 8 §3395"],
    ]
    source_table = Table(source_data, colWidths=[1.8*inch, 1.5*inch, 2.7*inch])
    source_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#f1f5f9')),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 9),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#e2e8f0')),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
    ]))
    elements.append(source_table)

    elements.append(Spacer(1, 24))

    # Footer
    footer_style = ParagraphStyle('Footer', parent=styles['Normal'], fontSize=9, textColor=colors.HexColor('#94a3b8'))
    elements.append(Paragraph("This report is generated by Shade, powered by FortyGuard 20m resolution data.", footer_style))
    elements.append(Paragraph("Governance thresholds are configurable decision-support examples and are not legal advice.", footer_style))
    elements.append(Paragraph("Heat-risk results should be reviewed by qualified safety and operations personnel.", footer_style))

    doc.build(elements)
    return buffer.getvalue()


@router.post("/generate")
async def generate_report(req: ReportRequest):
    """Generate a compliance report in PDF or CSV format."""
    sites = _get_sites()

    if req.scope == "site" and req.site_id:
        site = next((s for s in sites if s["site_id"] == req.site_id), None)
        if not site:
            raise HTTPException(status_code=404, detail=f"Site {req.site_id} not found")
        site_name = site["name"]
        site_id = req.site_id
    else:
        site_name = "All Sites"
        site_id = ""

    assessments = _get_assessments(site_id)

    # Generate PDF
    pdf_bytes = _generate_pdf_report(site_name, site_id, assessments, req.scope)

    # Save to Supabase
    if is_configured():
        try:
            sb = get_service_client()
            sb.table("compliance_reports").insert({
                "scope": req.scope,
                "site_id": site_id or None,
                "date_range_start": req.date_range_start or None,
                "date_range_end": req.date_range_end or None,
                "generated_at": datetime.utcnow().isoformat(),
            }).execute()
        except Exception:
            pass

    report_name = f"Shade_Heat_Exposure_Record_SG-1_{site_id or 'Company'}_{datetime.now().strftime('%Y%m%d')}"

    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{report_name}.pdf"'},
    )


@router.post("/csv")
async def generate_csv_report(req: ReportRequest):
    """Generate a CSV report."""
    sites = _get_sites()

    if req.scope == "site" and req.site_id:
        site = next((s for s in sites if s["site_id"] == req.site_id), None)
        if not site:
            raise HTTPException(status_code=404, detail=f"Site {req.site_id} not found")
        site_name = site["name"]
        site_id = req.site_id
    else:
        site_name = "All Sites"
        site_id = ""

    assessments = _get_assessments(site_id)

    # Generate CSV
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "Shade Heat Exposure Record — Form SG-1",
        f"Scope: {req.scope.title()}",
        f"Site: {site_name} ({site_id or 'All'})",
        f"Generated: {datetime.now().isoformat()}",
        "",
    ])
    writer.writerow([
        "Site ID", "Risk Bucket", "Temperature °C", "Heat Index",
        "Exceedance Hours", "Persistence Hours", "Threshold Source", "Recommendation"
    ])
    for a in assessments:
        writer.writerow([
            a.get("site_id", ""),
            a.get("risk_bucket", ""),
            a.get("temperature_c", ""),
            a.get("heat_index", ""),
            a.get("exceedance_hours", ""),
            a.get("persistence_hours", ""),
            a.get("threshold_source", ""),
            a.get("recommendation", ""),
        ])

    csv_bytes = output.getvalue().encode("utf-8")
    report_name = f"Shade_Heat_Exposure_Record_SG-1_{site_id or 'Company'}_{datetime.now().strftime('%Y%m%d')}"

    return StreamingResponse(
        io.BytesIO(csv_bytes),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{report_name}.csv"'},
    )
