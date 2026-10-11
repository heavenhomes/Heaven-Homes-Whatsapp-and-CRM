import mongoose from 'mongoose';

const propertySequenceSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true },
    value: { type: Number, required: true, default: 0 },
  },
  { versionKey: false, collection: 'property_sequences' }
);

const PropertySequence =
  mongoose.models.PropertySequence ||
  mongoose.model('PropertySequence', propertySequenceSchema);

export default PropertySequence;
