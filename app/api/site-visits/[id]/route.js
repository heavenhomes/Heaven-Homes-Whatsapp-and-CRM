import dbConnect, { isDbConnected } from "@/lib/mongodb";
import SiteVisit from "@/lib/models/SiteVisit";
import { NextResponse } from "next/server";

function isValidObjectId(id) {
  return /^[0-9a-fA-F]{24}$/.test(id);
}

// ---- PUT /api/site-visits/[id] ----
export async function PUT(request, { params }) {
  try {
    if (!isDbConnected()) {
      const conn = await dbConnect();
      if (!conn)
        return NextResponse.json({ error: "DB unavailable" }, { status: 503 });
    }

    const { id } = await params;
    if (!id || !isValidObjectId(id)) {
      return NextResponse.json(
        { error: "Invalid site visit ID" },
        { status: 400 },
      );
    }

    const body = await request.json();

    const allowed = [
      "scheduledDate",
      "scheduledTime",
      "channelPartnerName",
      "status",
      "notes",
    ];
    const clean = {};
    for (const k of allowed) if (body[k] !== undefined) clean[k] = body[k];

    const existing = await SiteVisit.findById(id);
    if (!existing)
      return NextResponse.json(
        { error: "Site visit not found" },
        { status: 404 },
      );

    // If the date changed and the status is now 'rescheduled', capture the old
    if (
      clean.scheduledDate &&
      new Date(clean.scheduledDate).getTime() !==
        new Date(existing.scheduledDate).getTime()
    ) {
      clean.rescheduledFrom = {
        date: existing.scheduledDate,
        time: existing.scheduledTime,
        rescheduledAt: new Date(),
      };
      if (clean.status === undefined) clean.status = "rescheduled";
    }

    const visit = await SiteVisit.findByIdAndUpdate(id, clean, {
      returnDocument: "after",
      runValidators: true,
    });
    let description = `Site visit updated: ${visit.leadName} → ${visit.propertyTitle}`;
    let severity = "info";

    if (existing.status !== visit.status) {
      if (visit.status === "completed") {
        description = `Site visit completed: ${visit.leadName} → ${visit.propertyTitle}`;
        severity = "success";
      } else if (visit.status === "cancelled") {
        description = `Site visit cancelled: ${visit.leadName} → ${visit.propertyTitle}`;
        severity = "warning";
      } else if (visit.status === "rescheduled") {
        description = `Site visit rescheduled: ${visit.leadName} → ${visit.propertyTitle}`;
        severity = "warning";
      }
    }

    // Logging must never poison a successful update — wrap it independently
    try {
      await logActivity(request, {
        action: `site_visit.${visit.status}`,
        category: "site_visit",
        description,
        targetType: "SiteVisit",
        targetId: visit._id,
        targetLabel: `${visit.leadName} · ${visit.propertyTitle}`,
        changes: { status: { from: existing.status, to: visit.status } },
        severity,
      });
    } catch (logErr) {
      console.error("[site-visits] activity log failed (non-fatal):", logErr);
    }

    return NextResponse.json({
      success: true,
      data: visit,
      message: "Site visit updated",
    });

    return NextResponse.json({
      success: true,
      data: visit,
      message: "Site visit updated",
    });
  } catch (error) {
    console.error("[site-visits] PUT error:", error);
    return NextResponse.json(
      { error: "Failed to update site visit", message: error.message },
      { status: 500 },
    );
  }
}

// ---- DELETE /api/site-visits/[id] ----
export async function DELETE(request, { params }) {
  try {
    if (!isDbConnected()) {
      const conn = await dbConnect();
      if (!conn)
        return NextResponse.json({ error: "DB unavailable" }, { status: 503 });
    }

    const { id } = await params;
    if (!id || !isValidObjectId(id)) {
      return NextResponse.json(
        { error: "Invalid site visit ID" },
        { status: 400 },
      );
    }

    const visit = await SiteVisit.findByIdAndDelete(id);
    if (!visit)
      return NextResponse.json(
        { error: "Site visit not found" },
        { status: 404 },
      );
    try {
      await logActivity(request, {
        action: "site_visit.deleted",
        category: "site_visit",
        description: `Site visit deleted: ${visit.leadName} → ${visit.propertyTitle}`,
        targetType: "SiteVisit",
        targetId: visit._id,
        targetLabel: `${visit.leadName} · ${visit.propertyTitle}`,
        severity: "danger",
      });
    } catch (logErr) {
      console.error("[site-visits] activity log failed (non-fatal):", logErr);
    }

    return NextResponse.json({ success: true, message: "Site visit deleted" });
    return NextResponse.json({ success: true, message: "Site visit deleted" });
  } catch (error) {
    console.error("[site-visits] DELETE error:", error);
    return NextResponse.json(
      { error: "Failed to delete site visit", message: error.message },
      { status: 500 },
    );
  }
}
