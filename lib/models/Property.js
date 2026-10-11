// lib/models/Property.js
import mongoose from 'mongoose';
import { toTitleCase } from '@/lib/place-names';

const propertySchema = new mongoose.Schema(
  {
    propertyId: { type: String, required: true, unique: true, index: true },
    title: { type: String, required: true },
    internalName: { type: String, default: '' }, // optional internal name for admin use
    city: { type: String, required: true, index: true },
    area: { type: String, required: true, index: true },

    // Top-level category: 'buy' | 'rent' | 'commercial'
    // Kept for backwards-compat. New flows set this from the category tab.
    propertyType: { type: String, required: true },

    // Sub type — apartment / villa / office / shop etc.
    propertySubType: { type: String, required: true },

    budgetRange: { type: String, required: true },
    price: { type: Number, required: true },

    configuration: { type: String, required: true }, // '1bhk' | '2bhk' | ... | 'commercial'
    spaceSize: { type: String, default: null },
    location: { type: String, required: true },
    areaSqft: { type: Number, required: true, default: 1000 },

    // ---- NEW: type-specific fields (all optional) ----
    dimensions: { type: String, default: '' },       // e.g. "40 x 50"
    facing: { type: String, default: '' },           // East / West / North / South / ...
    floor: { type: String, default: '' },            // Ground / 1st / ...
    monthlyRent: { type: Number, default: null },    // rent-only
    securityDeposit: { type: Number, default: null },
    brokerage: { type: Boolean, default: false },    // ← new (rent-only)
brokerageAmount: { type: Number, default: 0 },  // rent-only
    setupType: { type: String, default: '' },        // commercial-rent-only
    availableFrom: { type: String, default: '' },    // commercial-rent-only (free-text date)

    furnishing: {
      type: String,
      default: 'unfurnished',
      // 'unfurnished' | 'semi_furnished' | 'fully_furnished'
    },
    tenantPreferences: {
  type: [String],
  enum: ['bachelors', 'family', 'both'],
  default: [],
},
foodPreferences: {
  type: [String],
  enum: ['vegetarian', 'non_vegetarian'],
  default: [],
},

  // Lifecycle: pending → (available | rejected) → sold
//   - 'pending'   : submitted by a channel partner or the WhatsApp bot, awaiting owner approval
//   - 'available' : live on the property management page
//   - 'rejected'  : declined during verification; kept for audit
//   - 'sold'      : closed/deal done
//   - 'inactive'  : temporarily taken off the listings (can be set back to 'available')
status: {
  type: String,
  enum: ['pending', 'available', 'rejected', 'sold', 'inactive'],
  default: 'available',   // admins/owners default to live; the POST route forces 'pending' for partners
  index: true,
},

    source: { type: String, default: 'admin' }, // 'admin' | 'whatsapp_bot'
    ownerPhone: { type: String, index: true },
    ownerName: { type: String },
     uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'TeamMember',
      default: null,
      index: true,
    },
    description: { type: String },
    features: [{ type: String }],
    imageUrl: { type: String },
    imagePublicId: { type: String },
    images: [{ url: String, publicId: String }],
    videoLink: { type: String, default: '' },
    buildingStatus: {
      type: String,
      enum: ['under_construction', 'new_booking', 'resale_property', ''],
      default: '',
    },

    // NEW: category tab this property belongs to (used by the 4-tab form)
    categoryTab: {
      type: String,
      enum: ['residential_buy', 'commercial_buy', 'residential_rent', 'commercial_rent'],
      default: null,
      index: true,
    },

    views: { type: Number, default: 0 },
    inquiries: { type: Number, default: 0 },
  },
  { timestamps: true }
);

propertySchema.index({ status: 1, propertyType: 1, city: 1 });
propertySchema.index({ status: 1, budgetRange: 1 });
propertySchema.index({ status: 1, area: 1 });
propertySchema.index({ source: 1, status: 1 });

function normalizePlaceFields(doc) {
  if (!doc) return;
  if (typeof doc.city === 'string') doc.city = toTitleCase(doc.city);
  if (typeof doc.area === 'string') doc.area = toTitleCase(doc.area);
}

propertySchema.pre('save', function () {
  normalizePlaceFields(this);
});

propertySchema.pre('findOneAndUpdate', function () {
  const update = this.getUpdate() || {};
  normalizePlaceFields(update);
  if (update.$set) normalizePlaceFields(update.$set);
});

let placesCanonicalized = false;

propertySchema.statics.canonicalizePlaces = async function () {
  if (placesCanonicalized) return;
  placesCanonicalized = true;
  try {
    const docs = await this.find({}).select('city area').lean();
    const ops = [];
    for (const p of docs) {
      const city = toTitleCase(p.city);
      const area = toTitleCase(p.area);
      if (city !== (p.city || '') || area !== (p.area || '')) {
        ops.push({
          updateOne: {
            filter: { _id: p._id },
            update: { $set: { city, area } },
          },
        });
      }
    }
    if (ops.length) {
      await this.bulkWrite(ops, { ordered: false });
      console.log(`[places] Normalized city/area case on ${ops.length} properties`);
    }
  } catch (err) {
    placesCanonicalized = false;
    console.error('[places] Failed to normalize city/area case:', err.message);
  }
};

const Property =
  mongoose.models.Property || mongoose.model('Property', propertySchema);

export default Property;