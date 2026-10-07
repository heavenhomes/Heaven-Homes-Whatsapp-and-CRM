// app/api/properties/route.js
import dbConnect, { isDbConnected } from '@/lib/mongodb';
import Property from '@/lib/models/Property';
import { NextResponse } from 'next/server';
import { generateUniquePropertyId } from '@/lib/property-id';
import { logActivity } from '@/lib/activity/log';
import {
  verifySessionToken,
  SESSION_COOKIE_NAME,
} from '@/lib/auth/session';

const ALLOWED_FIELDS = [
  'title', 'internalName',
  'tenantPreferences', 'foodPreferences',
  'city', 'area', 'propertyType', 'propertySubType',
  'budgetRange', 'price', 'configuration', 'spaceSize', 'location',
  'areaSqft', 'furnishing', 'description', 'features', 'imageUrl',
  'imagePublicId', 'images', 'ownerPhone', 'ownerName', 'source',
  'dimensions', 'facing', 'floor', 'monthlyRent', 'securityDeposit',
  'setupType', 'availableFrom', 'categoryTab',
  'brokerage', 'brokerageAmount',
];

function escapeRegex(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ---------- GET ----------
export async function GET(request) {
  try {
    if (!isDbConnected()) {
      const conn = await dbConnect();
      if (!conn) return NextResponse.json({ error: 'DB unavailable' }, { status: 503 });
    }

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(200, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)));
    const skip = (page - 1) * limit;

    const city = searchParams.get('city');
    const category = searchParams.get('category');
    const status = searchParams.get('status');
    const minPrice = searchParams.get('minPrice');
    const maxPrice = searchParams.get('maxPrice');

    const query = {};

    if (status && status !== 'all') query.status = status;
    else if (!status) query.status = 'available';

    if (city) query.city = { $regex: escapeRegex(city), $options: 'i' };

    if (category) {
      if (category === 'residential_buy') {
        query.propertyType = 'buy';
        query.propertySubType = {
          $in: ['apartment', 'flat', 'house', 'villa', 'builder_floor', 'studio', 'penthouse', 'farmhouse'],
        };
      } else if (category === 'commercial_buy') {
        query.propertyType = 'commercial';
        query.categoryTab = 'commercial_buy';
      } else if (category === 'residential_rent') {
        query.propertyType = 'rent';
        query.categoryTab = 'residential_rent';
      } else if (category === 'commercial_rent') {
        query.propertyType = 'commercial';
        query.categoryTab = 'commercial_rent';
      } else {
        query.propertyType = category;
      }
    }

    if (minPrice || maxPrice) {
      query.price = {};
      if (minPrice) query.price.$gte = Number(minPrice);
      if (maxPrice) query.price.$lte = Number(maxPrice);
    }

    const [properties, total] = await Promise.all([
      Property.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Property.countDocuments(query),
    ]);

    return NextResponse.json({
      success: true,
      data: properties,
      pagination: { total, page, limit, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error('Error fetching properties:', error);
    return NextResponse.json(
      { error: 'Failed to fetch properties', message: error.message },
      { status: 500 }
    );
  }
}

// ---------- POST ----------
// ---------- POST ----------
export async function POST(request) {
  try {
    if (!isDbConnected()) {
      const conn = await dbConnect();
      if (!conn) return NextResponse.json({ error: 'DB unavailable' }, { status: 503 });
    }

    // ---- Determine caller role ----
    // Owners can publish directly. Everyone else (channel partners) must
    // go through the verification queue, regardless of what they submit.
    const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
    const session = verifySessionToken(token);
    const isOwner = session?.role === 'owner';
    const uploaderId = session?.sub || null;  

    const body = await request.json();

    const requiredFields = [
      'title', 'city', 'area', 'propertyType', 'propertySubType',
      'budgetRange', 'price', 'configuration', 'location', 'areaSqft',
    ];
    for (const field of requiredFields) {
      if (body[field] === undefined || body[field] === null || body[field] === '') {
        return NextResponse.json({ error: `Missing required field: ${field}` }, { status: 400 });
      }
    }

    const cleanBody = {};
    for (const key of ALLOWED_FIELDS) {
      if (body[key] !== undefined) cleanBody[key] = body[key];
    }
     if (!isOwner && uploaderId) {
      cleanBody.uploadedBy = uploaderId;
    }

    // ---- Server-side status enforcement ----
    // Never trust client-supplied `status`. Partners → pending. Owners → their choice.
    if (!isOwner) {
      cleanBody.status = 'pending';
    } else {
      cleanBody.status = body.status || 'available';
    }

    const propertyId = await generateUniquePropertyId(Property, body.city, body.area);

    const property = new Property({
      ...cleanBody,
      propertyId,
      views: 0,
      inquiries: 0,
    });

    await property.save();

    await logActivity(request, {
      action: isOwner ? 'property.created' : 'property.submitted_for_verification',
      category: 'property',
      description: isOwner
        ? `Property created: ${property.title}`
        : `Property submitted for verification: ${property.title}`,
      targetType: 'Property',
      targetId: property._id,
      targetLabel: property.title,
      severity: isOwner ? 'success' : 'info',
      changes: { price: property.price, city: property.city, status: property.status },
    });

    console.log('✅ Property created:', propertyId, '| status:', property.status);

    return NextResponse.json(
      {
        success: true,
        data: property,
        message: isOwner
          ? 'Property created successfully'
          : 'Property submitted for verification. It will appear on the Property Management page once approved.',
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating property:', error);
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map((e) => e.message);
      return NextResponse.json({ error: 'Validation failed', details: errors }, { status: 400 });
    }
    return NextResponse.json(
      { error: 'Failed to create property', details: error.message },
      { status: 500 }
    );
  }
}