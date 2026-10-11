import PropertySequence from '@/lib/models/PropertySequence';

export async function generateUniquePropertyId(Property) {
  let sequence = await PropertySequence.findById('property');

  if (!sequence) {
    const existingIds = await Property.find({
      propertyId: /^HH\d+$/,
    })
      .select('propertyId')
      .lean();
    const highestExisting = existingIds.reduce((highest, property) => {
      const number = Number(property.propertyId.slice(2));
      return Number.isSafeInteger(number) ? Math.max(highest, number) : highest;
    }, 0);

    try {
      sequence = await PropertySequence.create({
        _id: 'property',
        value: highestExisting,
      });
    } catch (error) {
      if (error.code !== 11000) throw error;
    }
  }

  while (true) {
    sequence = await PropertySequence.findByIdAndUpdate(
      'property',
      { $inc: { value: 1 } },
      { new: true }
    );

    if (!sequence) {
      throw new Error('Could not allocate a property ID');
    }

    const propertyId = `HH${String(sequence.value).padStart(3, '0')}`;
    if (!(await Property.exists({ propertyId }))) return propertyId;
  }
}
