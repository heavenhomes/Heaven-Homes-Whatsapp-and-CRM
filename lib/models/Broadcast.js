import mongoose from 'mongoose';

const broadcastSchema = new mongoose.Schema(
  {
    message: {
      type: String,
      required: true,
    },
    recipients: [
      {
        type: String,
      },
    ],
    filters: {
      city: String,
      propertyType: String,
      configuration: String,
    },
    status: {
      type: String,
      enum: ['pending', 'sent', 'failed', 'partial'],
      default: 'pending',
    },
    sentCount: {
      type: Number,
      default: 0,
    },
    failedCount: {
      type: Number,
      default: 0,
    },
    sentAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

broadcastSchema.pre('save', function () {
  if (this.status === 'sent' && !this.sentAt) {
    this.sentAt = new Date();
  }
});

const Broadcast =
  mongoose.models.Broadcast ||
  mongoose.model('Broadcast', broadcastSchema);

export default Broadcast;