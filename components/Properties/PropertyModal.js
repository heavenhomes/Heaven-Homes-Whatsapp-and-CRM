"use client";
import { useState, useEffect, useMemo } from 'react';
import toast from 'react-hot-toast';
import ImageUpload from './ImageUpload';


const INPUT_CLASS =
  'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-[#2d7a3a] focus:border-[#2d7a3a]';

const TABS = [
  { id: 'residential_buy', label: 'Residential Buy' },
  { id: 'commercial_buy', label: 'Commercial Buy' },
  { id: 'residential_rent', label: 'Residential Rent' },
  { id: 'commercial_rent', label: 'Commercial Rent' },
];

const FACINGS = ['East', 'West', 'North', 'South', 'North-East', 'North-West', 'South-East', 'South-West'];
const FLOORS = ['Ground', '1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th', '10th', 'Basement', 'Upper'];
const FURNISHING = ['unfurnished', 'semi_furnished', 'fully_furnished'];
const SETUP_TYPES = ['Bare Shell', 'Warm Shell', 'Fully Fitted', 'Furnished'];
const TENANT_PREFERENCES = [
  { value: 'bachelors', label: 'Bachelors' },
  { value: 'family', label: 'Family' },
  { value: 'both', label: 'Both' },
];

const FOOD_PREFERENCES = [
  { value: 'vegetarian', label: 'Vegetarian' },
  { value: 'non_vegetarian', label: 'Non-Vegetarians' },
];

const RES_BUY_TYPES = ['apartment', 'flat', 'house', 'villa', 'builder_floor', 'studio', 'penthouse', 'farmhouse','plot'];
const COM_BUY_TYPES = ['office', 'shop', 'showroom', 'warehouse', 'industrial', 'coworking'];
const RES_RENT_TYPES = ['apartment', 'flat', 'house', 'villa', 'builder_floor', 'pg', 'studio', 'farmhouse'];
const COM_RENT_TYPES = ['office', 'shop', 'showroom', 'warehouse', 'coworking', 'factory'];

const RESIDENTIAL_CONFIGS = ['1rk', '1bhk', '2bhk', '3bhk', '4bhk', '5bhk_plus', 'duplex', 'triplex'];

const FEATURE_LISTS = {
  residential_buy: [
    'RERA Approved', 'Bank Loan Available', 'Covered Parking', 'Visitor Parking',
    'Power Backup', 'Lift', 'Swimming Pool', 'Gym', 'Club House', 'Garden',
    'Children Play Area', 'Jogging Track', 'Temple', 'Community Hall', 'Indoor Games',
    'Outdoor Sports Area', '24×7 Security', 'CCTV Surveillance', 'Intercom',
    'Gated Society', 'Fire Safety', 'Water Supply', 'Rain Water Harvesting',
    'Waste Management', 'Modular Kitchen', 'Balcony', 'Servant Room', 'Store Room',
    'Study Room', 'Private Terrace', 'Corner Property', 'Park Facing', 'Road Facing',
    'Vaastu Compliant', 'Wheelchair Accessible', 'Pet Friendly',
  ],
  commercial_buy: [
    'RERA Approved', 'Main Road Facing', 'Corner Property', 'High Footfall Location',
    'Premium Location', 'Power Backup', 'Lift', 'Visitor Parking', 'Reserved Parking',
    'CCTV Surveillance', '24×7 Security', 'Fire Fighting System', 'Reception Area',
    'Conference Room', 'Cabins', 'Meeting Room', 'Central Air Conditioning',
    'Internet Ready', 'Pantry', 'Washroom', 'Cafeteria', 'Waiting Lounge',
    'Goods Lift', 'Loading Dock', 'Truck Access', 'Metro Nearby', 'Bus Stop Nearby',
    'Bank Loan Available', 'Wheelchair Accessible', 'DG Backup', 'EV Charging',
    'Water Supply', 'Separate Electricity Connection', 'Separate Entry & Exit',
    'Signage Space Available', 'Double Height Entrance',
  ],
  residential_rent: [
    'Covered Parking', 'Visitor Parking', 'Lift', 'Swimming Pool', 'Gym', 'Club House',
    'Garden', "Children's Play Area", 'Jogging Track', '24×7 Security', 'CCTV Surveillance',
    'Intercom', 'Gated Society', 'Power Backup', 'Water Supply', 'Balcony',
    'Modular Kitchen', 'Store Room', 'Study Room', 'Servant Room', 'Park Facing',
    'Corner Property', 'Vaastu Compliant', 'Pet Friendly', 'Wheelchair Accessible',
    'Nearby School', 'Nearby Hospital', 'Nearby Market', 'Metro Nearby',
  ],
  commercial_rent: [
    'Power Backup', 'Lift', 'Reception Area', 'Conference Room', 'Cabins', 'Meeting Room',
    'Central Air Conditioning', 'Visitor Parking', 'Reserved Parking', 'Internet Ready',
    'Pantry', 'Washroom', 'Cafeteria', 'Fire Fighting System', 'CCTV Surveillance',
    '24×7 Security', 'Main Road Facing', 'High Footfall Location', 'Corner Property',
    'Goods Lift', 'Loading Dock', 'Truck Access', 'DG Backup', 'Separate Entry & Exit',
    'EV Charging', 'Metro Nearby', 'Bus Stop Nearby', 'Wheelchair Accessible',
  ],
};

const SUBTYPE_LABEL = {
  apartment: 'Apartment / Flat', flat: 'Flat', house: 'House/Villa', villa: 'Villa',
  builder_floor: 'Builder Floor', studio: 'Studio', penthouse: 'Penthouse',
  farmhouse: 'Farmhouse', pg: 'PG', office: 'Office Space', shop: 'Shop / Retail',
  showroom: 'Showroom', warehouse: 'Warehouse / Godown', industrial: 'Industrial',
  coworking: 'Co-working Space', factory: 'Factory',
  plot: 'Plot / Land',
};

const EMPTY_FORM = {
  categoryTab: 'residential_buy',
  internalName: '',
  title: '',
  city: '',
  area: '',
  propertyType: 'buy',
  propertySubType: 'apartment',
  configuration: '2bhk',
  areaSqft: '',
  dimensions: '',
  price: '',
  monthlyRent: '',
  securityDeposit: '',
  furnishing: 'unfurnished',
  facing: '',
  floor: '',
  setupType: '',
  availableFrom: '',
  description: '',
  features: [],
  imageUrl: '',
  imagePublicId: '',
  status: 'available',
  budgetRange: 'mid',
  location: '',
  tenantPreferences: [],
  foodPreferences: [],
  brokerage: false,          // ← new
  brokerageAmount: '', 
};

export default function PropertyModal({ isOpen, onClose, onSave, property, isOwner = false }) {
  const [categoryTab, setCategoryTab] = useState('residential_buy');
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [uploading, setUploading] = useState(false);

  // When editing, infer category tab from the property
  useEffect(() => {
    if (property) {
      let tab = property.categoryTab;
      if (!tab) {
        if (property.propertyType === 'buy') tab = 'residential_buy';
        else if (property.propertyType === 'rent') tab = 'residential_rent';
        else if (property.propertyType === 'commercial') tab = 'commercial_buy';
        else tab = 'residential_buy';
      }
      setCategoryTab(tab);
      setFormData({
        categoryTab: tab,
        internalName: property.internalName || '',
        title: property.title || '',
        city: property.city || '',
        area: property.area || '',
        propertyType: property.propertyType || 'buy',
        propertySubType: property.propertySubType || 'apartment',
        configuration: property.configuration || '2bhk',
        areaSqft: property.areaSqft || '',
        dimensions: property.dimensions || '',
        price: property.price || '',
        monthlyRent: property.monthlyRent || '',
        securityDeposit: property.securityDeposit || '',
        furnishing: property.furnishing || 'unfurnished',
        facing: property.facing || '',
        floor: property.floor || '',
        setupType: property.setupType || '',
        availableFrom: property.availableFrom || '',
        description: property.description || '',
        features: property.features || [],
        imageUrl: property.imageUrl || '',
        imagePublicId: property.imagePublicId || '',
        status: property.status || 'available',
        budgetRange: property.budgetRange || 'mid',
        location: property.location || '',
        tenantPreferences: property.tenantPreferences || [],
foodPreferences: property.foodPreferences || [],
brokerage: property.brokerage || false,
brokerageAmount: property.brokerageAmount || '',
      });
    } else {
      setFormData(EMPTY_FORM);
      setCategoryTab('residential_buy');
    }
  }, [property, isOpen]);

  // Update form's propertyType when categoryTab changes
  useEffect(() => {
    const map = {
      residential_buy: { propertyType: 'buy', propertySubType: 'apartment' },
      commercial_buy: { propertyType: 'commercial', propertySubType: 'office' },
      residential_rent: { propertyType: 'rent', propertySubType: 'apartment' },
      commercial_rent: { propertyType: 'commercial', propertySubType: 'office' },
    };
    if (map[categoryTab]) {
      setFormData((prev) => ({ ...prev, categoryTab, ...map[categoryTab] }));
    }
  }, [categoryTab]);
  // Plots don't have a BHK configuration — set it automatically instead
useEffect(() => {
  if (categoryTab === 'residential_buy' && formData.propertySubType === 'plot' && formData.configuration !== 'plot') {
    setFormData((prev) => ({ ...prev, configuration: 'plot' }));
  }
}, [categoryTab, formData.propertySubType]);

  const featureList = FEATURE_LISTS[categoryTab] || [];

  const subtypeOptions = useMemo(() => {
    if (categoryTab === 'residential_buy') return RES_BUY_TYPES;
    if (categoryTab === 'commercial_buy') return COM_BUY_TYPES;
    if (categoryTab === 'residential_rent') return RES_RENT_TYPES;
    return COM_RENT_TYPES;
  }, [categoryTab]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const toggleFeature = (feature) => {
    setFormData((prev) => {
      const has = prev.features.includes(feature);
      return {
        ...prev,
        features: has
          ? prev.features.filter((f) => f !== feature)
          : [...prev.features, feature],
      };
    });
  };
  const toggleArrayValue = (field, value) => {
  setFormData((prev) => {
    const arr = Array.isArray(prev[field]) ? prev[field] : [];
    const has = arr.includes(value);
    return {
      ...prev,
      [field]: has ? arr.filter((v) => v !== value) : [...arr, value],
    };
  });
};

  const handleImageUpload = (imageData) => {
    setFormData((prev) => ({
      ...prev,
      imageUrl: imageData.url || '',
      imagePublicId: imageData.publicId || '',
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const required = ['title', 'city', 'area', 'areaSqft'];
    if (categoryTab === 'residential_buy' || categoryTab === 'commercial_buy') {
      required.push('price');
    } else {
      required.push('monthlyRent');
    }

    for (const f of required) {
      if (!formData[f]) {
        toast.error(`Please fill: ${f}`);
        return;
      }
    }

    const submitData = {
      ...formData,
      categoryTab,
      tenantPreferences: Array.isArray(formData.tenantPreferences) ? formData.tenantPreferences : [],
      foodPreferences: Array.isArray(formData.foodPreferences) ? formData.foodPreferences : [],
      areaSqft: Number(formData.areaSqft) || 0,
      location: `${formData.area}, ${formData.city}`,
       brokerage: !!formData.brokerage,                                          // ← new
  brokerageAmount: formData.brokerage ? Number(formData.brokerageAmount) || 0 : 0,  // ← new
      
    };

    if (categoryTab === 'residential_buy' || categoryTab === 'commercial_buy') {
      submitData.price = Number(formData.price) || 0;
      submitData.propertyType = categoryTab === 'commercial_buy' ? 'commercial' : 'buy';
    } else {
      submitData.price = Number(formData.monthlyRent) || 0;
      submitData.monthlyRent = Number(formData.monthlyRent) || 0;
      submitData.securityDeposit = Number(formData.securityDeposit) || 0;
      submitData.propertyType = categoryTab === 'commercial_rent' ? 'commercial' : 'rent';
    }

    if (categoryTab === 'commercial_buy' || categoryTab === 'commercial_rent') {
      submitData.configuration = 'commercial';
    }

    const p = submitData.price;
    if (submitData.propertyType === 'rent' || submitData.propertyType === 'commercial') {
      if (p < 10000) submitData.budgetRange = 'low';
      else if (p < 20000) submitData.budgetRange = 'mid';
      else if (p < 40000) submitData.budgetRange = 'high';
      else submitData.budgetRange = 'luxury';
    } else {
      if (p < 5000000) submitData.budgetRange = 'low';
      else if (p < 10000000) submitData.budgetRange = 'mid';
      else submitData.budgetRange = 'high';
    }

    console.log('[PropertyModal] submitData:', submitData); // ← debug: see what's sent
    await onSave(submitData);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="fixed inset-0 bg-gray-500/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative min-h-screen flex items-center justify-center p-4">
        <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
          {/* Header */}
          <div className="sticky top-0 bg-white rounded-t-2xl border-b border-gray-100 px-6 py-5 z-10">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-gray-800">
                  {property ? 'Edit Property' : 'Add New Property'}
                </h2>
                <p className="text-sm text-gray-500 mt-0.5">
                  {property ? 'Update property details' : 'Create a new property listing'}
                </p>
              </div>
              <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="mt-4 flex gap-1 overflow-x-auto">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setCategoryTab(t.id)}
                  className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-colors ${
                    categoryTab === t.id
                      ? 'bg-[#2d7a3a] text-white shadow-sm'
                      : 'text-[#4f6b4f] hover:bg-[#f0f7ef]'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            <ImageUpload
              currentImage={formData.imageUrl}
              onImageUpload={handleImageUpload}
              uploading={uploading}
              setUploading={setUploading}
            />

            {/* Common: Title, Internal Name, City, Area, SubType */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Public Property Title" required>
                <input
                  type="text"
                  name="title"
                  value={formData.title}
                  onChange={handleChange}
                  placeholder={
                    categoryTab === 'commercial_buy' || categoryTab === 'commercial_rent'
                      ? 'Premium Office Space in Super Corridor'
                      : '3 BHK Premium Apartment in Vijay Nagar'
                  }
                  className={INPUT_CLASS}
                />
                <p className="text-[11px] text-gray-500 mt-1">
                  This name is shown to buyers/tenants on WhatsApp.
                </p>
              </Field>

              <Field label="Your Private Name (internal)">
                <input
                  type="text"
                  name="internalName"
                  value={formData.internalName}
                  onChange={handleChange}
                  placeholder="e.g., Flat 302, Sai Residency"
                  className={INPUT_CLASS}
                />
                <p className="text-[11px] text-gray-500 mt-1">
                  Only you (and admins) will see this. Not shared with buyers.
                </p>
              </Field>

              <Field label="City" required>
                <input
                  type="text"
                  name="city"
                  value={formData.city}
                  onChange={handleChange}
                  placeholder="Indore"
                  className={INPUT_CLASS}
                />
              </Field>

              <Field label="Area" required>
                <input
                  type="text"
                  name="area"
                  value={formData.area}
                  onChange={handleChange}
                  placeholder="Vijay Nagar"
                  className={INPUT_CLASS}
                />
              </Field>

              <Field label="Property Type" required>
                <select
                  name="propertySubType"
                  value={formData.propertySubType}
                  onChange={handleChange}
                  className={INPUT_CLASS}
                >
                  <option value="">Select type</option>
                  {subtypeOptions.map((s) => (
                    <option key={s} value={s}>{SUBTYPE_LABEL[s] || s}</option>
                  ))}
                </select>
              </Field>
            </div>

            {categoryTab === 'residential_buy' && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                 {formData.propertySubType !== 'plot' && (
                <Field label="Configuration" required>
                  <select name="configuration" value={formData.configuration} onChange={handleChange} className={INPUT_CLASS}>
                    <option value="">Select configuration</option>
                    {RESIDENTIAL_CONFIGS.map((c) => (
                      <option key={c} value={c}>{c.toUpperCase().replace('BHK', ' BHK')}</option>
                    ))}
                  </select>
                </Field> )}
                <Field label="Area / Size (Sq Ft)" required>
                  <input type="number" name="areaSqft" value={formData.areaSqft} onChange={handleChange} placeholder="1450" className={INPUT_CLASS} />
                </Field>
                <Field label="Dimensions">
                  <input type="text" name="dimensions" value={formData.dimensions} onChange={handleChange} placeholder="40 x 50" className={INPUT_CLASS} />
                </Field>
                <Field label="Price (₹)" required>
                  <input type="number" name="price" value={formData.price} onChange={handleChange} placeholder="7200000" className={INPUT_CLASS} />
                </Field>
                <Field label="Facing">
                  <select name="facing" value={formData.facing} onChange={handleChange} className={INPUT_CLASS}>
                    <option value="">Select facing</option>
                    {FACINGS.map((f) => <option key={f} value={f}>{f}</option>)}
                  </select>
                </Field>
                <Field label="Floor">
                  <select name="floor" value={formData.floor} onChange={handleChange} className={INPUT_CLASS}>
                    <option value="">Select floor</option>
                    {FLOORS.map((f) => <option key={f} value={f}>{f}</option>)}
                  </select>
                </Field>
              </div>
            )}

            {categoryTab === 'commercial_buy' && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Field label="Carpet Area (Sq Ft)" required>
                  <input type="number" name="areaSqft" value={formData.areaSqft} onChange={handleChange} placeholder="1450" className={INPUT_CLASS} />
                </Field>
                <Field label="Price (₹)" required>
                  <input type="number" name="price" value={formData.price} onChange={handleChange} placeholder="7200000" className={INPUT_CLASS} />
                </Field>
                <Field label="Facing">
                  <select name="facing" value={formData.facing} onChange={handleChange} className={INPUT_CLASS}>
                    <option value="">Select facing</option>
                    {FACINGS.map((f) => <option key={f} value={f}>{f}</option>)}
                  </select>
                </Field>
                <Field label="Floor">
                  <select name="floor" value={formData.floor} onChange={handleChange} className={INPUT_CLASS}>
                    <option value="">Select floor</option>
                    {FLOORS.map((f) => <option key={f} value={f}>{f}</option>)}
                  </select>
                </Field>
              </div>
            )}

            {categoryTab === 'residential_rent' && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Field label="Configuration" required>
                  <select name="configuration" value={formData.configuration} onChange={handleChange} className={INPUT_CLASS}>
                    <option value="">Select configuration</option>
                    {RESIDENTIAL_CONFIGS.map((c) => (
                      <option key={c} value={c}>{c.toUpperCase().replace('BHK', ' BHK')}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Area / Size (Sq Ft)" required>
                  <input type="number" name="areaSqft" value={formData.areaSqft} onChange={handleChange} placeholder="1450" className={INPUT_CLASS} />
                </Field>
                <Field label="Monthly Rent (₹)" required>
                  <input type="number" name="monthlyRent" value={formData.monthlyRent} onChange={handleChange} placeholder="22000" className={INPUT_CLASS} />
                </Field>
                <Field label="Security Deposit (₹)">
                  <input type="number" name="securityDeposit" value={formData.securityDeposit} onChange={handleChange} placeholder="44000" className={INPUT_CLASS} />
                </Field>
                <Field label="Furnishing">
                  <select name="furnishing" value={formData.furnishing} onChange={handleChange} className={INPUT_CLASS}>
                    <option value="">Select furnishing</option>
                    {FURNISHING.map((f) => <option key={f} value={f}>{f.replace('_', ' ')}</option>)}
                  </select>
                </Field>
                <Field label="Floor">
                  <select name="floor" value={formData.floor} onChange={handleChange} className={INPUT_CLASS}>
                    <option value="">Select floor</option>
                    {FLOORS.map((f) => <option key={f} value={f}>{f}</option>)}
                  </select>
                </Field>
                {/* Tenant Preferences */}
<div className="md:col-span-3">
  <p className="block text-sm font-medium text-gray-700 mb-1">Tenant Preferences</p>
  <div className="flex flex-wrap gap-4">
    {TENANT_PREFERENCES.map((opt) => (
      <label
        key={opt.value}
        className="inline-flex items-center gap-2 text-sm text-gray-700 cursor-pointer"
      >
        <input
          type="checkbox"
          checked={formData.tenantPreferences.includes(opt.value)}
          onChange={() => toggleArrayValue('tenantPreferences', opt.value)}
          className="w-4 h-4 text-[#2d7a3a] border-gray-300 rounded focus:ring-[#2d7a3a]"
        />
        {opt.label}
      </label>
    ))}
  </div>
</div>

{/* Food Preferences */}
<div className="md:col-span-3">
  <p className="block text-sm font-medium text-gray-700 mb-1">Food Preferences</p>
  <div className="flex flex-wrap gap-4">
    {FOOD_PREFERENCES.map((opt) => (
      <label
        key={opt.value}
        className="inline-flex items-center gap-2 text-sm text-gray-700 cursor-pointer"
      >
        <input
          type="checkbox"
          checked={formData.foodPreferences.includes(opt.value)}
          onChange={() => toggleArrayValue('foodPreferences', opt.value)}
          className="w-4 h-4 text-[#2d7a3a] border-gray-300 rounded focus:ring-[#2d7a3a]"
        />
        {opt.label}
      </label>
    ))}
  </div>
</div>

{/* Brokerage */}
<div className="md:col-span-3">
  <label className="inline-flex items-center gap-2 text-sm font-medium text-gray-700 cursor-pointer">
    <input
      type="checkbox"
      checked={!!formData.brokerage}
      onChange={(e) =>
        setFormData((p) => ({
          ...p,
          brokerage: e.target.checked,
          brokerageAmount: e.target.checked ? p.brokerageAmount : '',
        }))
      }
      className="w-4 h-4 text-[#2d7a3a] border-gray-300 rounded focus:ring-[#2d7a3a]"
    />
    Brokerage Applicable
  </label>

  {formData.brokerage && (
    <div className="mt-3 max-w-xs">
      <Field label="Brokerage Amount (₹)">
        <input
          type="number"
          name="brokerageAmount"
          value={formData.brokerageAmount}
          onChange={handleChange}
          placeholder="e.g., 22000"
          className={INPUT_CLASS}
        />
      </Field>
    </div>
  )}
</div>
              </div>
            )}

            {categoryTab === 'commercial_rent' && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Field label="Carpet Area (Sq Ft)" required>
                  <input type="number" name="areaSqft" value={formData.areaSqft} onChange={handleChange} placeholder="1450" className={INPUT_CLASS} />
                </Field>
                <Field label="Monthly Rent (₹)" required>
                  <input type="number" name="monthlyRent" value={formData.monthlyRent} onChange={handleChange} placeholder="22000" className={INPUT_CLASS} />
                </Field>
                <Field label="Security Deposit (₹)">
                  <input type="number" name="securityDeposit" value={formData.securityDeposit} onChange={handleChange} placeholder="44000" className={INPUT_CLASS} />
                </Field>
                <Field label="Setup Type">
                  <select name="setupType" value={formData.setupType} onChange={handleChange} className={INPUT_CLASS}>
                    <option value="">Select setup type</option>
                    {SETUP_TYPES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </Field>
                <Field label="Available From">
                  <input type="date" name="availableFrom" value={formData.availableFrom} onChange={handleChange} className={INPUT_CLASS} />
                </Field>
                <Field label="Floor">
                  <select name="floor" value={formData.floor} onChange={handleChange} className={INPUT_CLASS}>
                    <option value="">Select floor</option>
                    {FLOORS.map((f) => <option key={f} value={f}>{f}</option>)}
                  </select>
                </Field>
                {/* Brokerage */}
<div className="md:col-span-3">
  <label className="inline-flex items-center gap-2 text-sm font-medium text-gray-700 cursor-pointer">
    <input
      type="checkbox"
      checked={!!formData.brokerage}
      onChange={(e) =>
        setFormData((p) => ({
          ...p,
          brokerage: e.target.checked,
          brokerageAmount: e.target.checked ? p.brokerageAmount : '',
        }))
      }
      className="w-4 h-4 text-[#2d7a3a] border-gray-300 rounded focus:ring-[#2d7a3a]"
    />
    Brokerage Applicable
  </label>

  {formData.brokerage && (
    <div className="mt-3 max-w-xs">
      <Field label="Brokerage Amount (₹)">
        <input
          type="number"
          name="brokerageAmount"
          value={formData.brokerageAmount}
          onChange={handleChange}
          placeholder="e.g., 22000"
          className={INPUT_CLASS}
        />
      </Field>
    </div>
  )}
</div>
              </div>
            )}

            {/* Features */}
            <div>
              <p className="block text-sm font-medium text-gray-700 mb-1">Features</p>
              <p className="text-xs text-gray-500 mb-2">Click tags below to add features</p>
              <div className="flex flex-wrap gap-2">
                {featureList.map((f) => {
                  const active = formData.features.includes(f);
                  return (
                    <button
                      key={f}
                      type="button"
                      onClick={() => toggleFeature(f)}
                      className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                        active
                          ? 'bg-[#2d7a3a] text-white border-[#2d7a3a]'
                          : 'bg-white text-[#4f6b4f] border-[#e8f0e6] hover:border-[#2d7a3a] hover:text-[#2d7a3a]'
                      }`}
                    >
                      {f}
                    </button>
                  );
                })}
              </div>
            </div>

            <Field label="Additional Information">
              <textarea
                name="description"
                value={formData.description}
                onChange={handleChange}
                rows={4}
                placeholder="Anything else buyers should know…"
                className={INPUT_CLASS}
              />
            </Field>
{isOwner ? (
  <Field label="Status">
    <select name="status" value={formData.status} onChange={handleChange} className={INPUT_CLASS}>
      <option value="available">Available</option>
      <option value="pending">Pending (Verification)</option>
      <option value="rejected">Rejected</option>
      <option value="sold">Sold</option>
    </select>
  </Field>
) : (
  <div className="rounded-xl border border-[#fff5d6] bg-[#fffbf0] px-4 py-3 text-sm text-[#a67c00] flex items-start gap-2">
    <span className="text-base leading-none mt-0.5">🔎</span>
    <span>
      Your property will be submitted for <strong>owner verification</strong>. It will appear on
      the Property Management page only after approval.
    </span>
  </div>
)}

            <div className="flex flex-col sm:flex-row justify-end gap-3 pt-4 border-t border-gray-100">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-6 py-2 bg-[#2d7a3a] text-white rounded-lg text-sm font-medium hover:bg-[#23682e] transition-colors"
              >
                {property ? 'Update Property' : 'Add Property'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

function Field({ label, required, children }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {children}
    </div>
  );
}