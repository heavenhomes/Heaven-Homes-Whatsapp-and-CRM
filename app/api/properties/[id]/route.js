// app/api/properties/[id]/route.js
import dbConnect, { isDbConnected } from '@/lib/mongodb';
import Property from '@/lib/models/Property';
import { NextResponse } from 'next/server';
import { logActivity } from '@/lib/activity/log';
import {
  notifyLandlordApproved,
  notifyLandlordRejected,
  notifyLandlordRented,
} from '@/lib/notify-landlord';
import {
  verifySessionToken,
  SESSION_COOKIE_NAME,
} from '@/lib/auth/session';

const ALLOWED_UPDATE_FIELDS = [
  'title', 'internalName',
  'tenantPreferences', 'foodPreferences',
  'city', 'area', 'propertyType', 'propertySubType',
  'budgetRange', 'price', 'configuration', 'spaceSize', 'location',
  'areaSqft', 'furnishing', 'status', 'description', 'features',
  'imageUrl', 'imagePublicId', 'images', 'ownerPhone', 'ownerName', 'source',
  'dimensions', 'facing', 'floor', 'monthlyRent', 'securityDeposit',
  'setupType', 'availableFrom', 'categoryTab',
  'brokerage', 'brokerageAmount',
];

function isValidObjectId(id) {
  return /^[0-9a-fA-F]{24}$/.test(id);
}

// ---------- GET ----------
export async function GET(request, { params }) {
  try {
    if (!isDbConnected()) {
      const conn = await dbConnect();
      if (!conn) return NextResponse.json({ error: 'DB unavailable' }, { status: 503 });
    }

    const { id } = await params;
    if (!id || !isValidObjectId(id)) {
      return NextResponse.json({ error: 'Invalid property ID format' }, { status: 400 });
    }

    const property = await Property.findById(id);
    if (!property) return NextResponse.json({ error: 'Property not found' }, { status: 404 });

    return NextResponse.json({ success: true, data: property });
  } catch (error) {
    console.error('Error fetching property:', error);
    return NextResponse.json(
      { error: 'Failed to fetch property', message: error.message },
      { status: 500 }
    );
  }
}

// ---------- PUT ----------
export async function PUT(request, { params }) {
  try {
    if (!isDbConnected()) {
      const conn = await dbConnect();
      if (!conn) return NextResponse.json({ error: 'DB unavailable' }, { status: 503 });
    }

    const { id } = await params;
    const body = await request.json();

    if (!id || !isValidObjectId(id)) {
      return NextResponse.json({ error: 'Invalid property ID format' }, { status: 400 });
    }
    const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
const session = verifySessionToken(token);
const isOwner = session?.role === 'owner';

   const cleanBody = {};
for (const key of ALLOWED_UPDATE_FIELDS) {
  if (body[key] === undefined) continue;
  if (key === 'status' && !isOwner) continue;  // ← ignore status changes from non-owners
  cleanBody[key] = body[key];
}

    const existing = await Property.findById(id);
    if (!existing) return NextResponse.json({ error: 'Property not found' }, { status: 404 });

    const previousStatus = existing.status;

    const property = await Property.findByIdAndUpdate(id, cleanBody, {
      returnDocument: 'after',
      runValidators: true,
    });

    console.log('✅ Property updated:', property.propertyId);

    // ─── Notifications ───
    const isWhatsAppListing = property.source === 'whatsapp_bot';
    const statusChanged = previousStatus !== property.status;

    if (isWhatsAppListing && statusChanged) {
      let notifyPromise = null;
      if (
        property.status === 'available' &&
        ['pending', 'rejected'].includes(previousStatus)
      ) {
        // Only on real approval (pending/rejected -> available), not when an
        // owner just toggles a listing inactive -> available again.
        notifyPromise = notifyLandlordApproved(property);
      } else if (property.status === 'rejected') {
        // Optional reason can be sent by the UI as `rejectionReason`.
        notifyPromise = notifyLandlordRejected(property, body.rejectionReason || '');
      } else if (property.status === 'sold') {
        notifyPromise = notifyLandlordRented(property);
      }
      if (notifyPromise) {
        notifyPromise
          .then((sent) => {
            if (!sent) {
              console.warn(
                `[property-update] WhatsApp notification NOT delivered for ${property.propertyId} (status: ${property.status}).`
              );
            }
          })
          .catch((err) =>
            console.error('[property-update] Notification failed:', err.message)
          );
      }
    }

    // ─── Activity log ───
    if (previousStatus !== property.status) {
      if (property.status === 'sold') {
        await logActivity(request, {
          action: 'property.sold',
          category: 'property',
          description: `Property marked as SOLD: ${property.title}`,
          targetType: 'Property',
          targetId: property._id,
          targetLabel: property.title,
          severity: 'success',
          changes: { status: { from: previousStatus, to: property.status } },
        });
      } else if (property.status === 'available') {
        await logActivity(request, {
          action: 'property.listed',
          category: 'property',
          description: `Property is now Available: ${property.title}`,
          targetType: 'Property',
          targetId: property._id,
          targetLabel: property.title,
          severity: 'info',
          changes: { status: { from: previousStatus, to: property.status } },
        });
      } else {
        // inactive / pending / rejected etc. - previously these changes were
        // not logged at all.
        await logActivity(request, {
          action: 'property.status_changed',
          category: 'property',
          description: `Property status changed to ${property.status}: ${property.title}`,
          targetType: 'Property',
          targetId: property._id,
          targetLabel: property.title,
          severity: 'info',
          changes: { status: { from: previousStatus, to: property.status } },
        });
      }
    } else {
      await logActivity(request, {
        action: 'property.updated',
        category: 'property',
        description: `Property updated: ${property.title}`,
        targetType: 'Property',
        targetId: property._id,
        targetLabel: property.title,
        severity: 'info',
      });
    }

    return NextResponse.json({
      success: true,
      data: property,
      message: 'Property updated successfully',
    });
  } catch (error) {
    console.error('Error updating property:', error);
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map((e) => e.message);
      return NextResponse.json({ error: 'Validation failed', details: errors }, { status: 400 });
    }
    return NextResponse.json(
      { error: 'Failed to update property', message: error.message },
      { status: 500 }
    );
  }
}

// ---------- DELETE ----------
export async function DELETE(request, { params }) {
  try {
    if (!isDbConnected()) {
      const conn = await dbConnect();
      if (!conn) return NextResponse.json({ error: 'DB unavailable' }, { status: 503 });
    }

    const { id } = await params;
    if (!id || !isValidObjectId(id)) {
      return NextResponse.json({ error: 'Invalid property ID format' }, { status: 400 });
    }

    const property = await Property.findByIdAndDelete(id);
    if (!property) return NextResponse.json({ error: 'Property not found' }, { status: 404 });

    console.log('✅ Property deleted:', property.propertyId);

    await logActivity(request, {
      action: 'property.deleted',
      category: 'property',
      description: `Property deleted: ${property.title}`,
      targetType: 'Property',
      targetId: property._id,
      targetLabel: property.title,
      severity: 'danger',
    });

    return NextResponse.json({
      success: true,
      message: 'Property deleted successfully',
      deletedProperty: {
        id: property._id,
        propertyId: property.propertyId,
        title: property.title,
      },
    });
  } catch (error) {
    console.error('Error deleting property:', error);
    return NextResponse.json(
      { error: 'Failed to delete property', message: error.message },
      { status: 500 }
    );
  }
}