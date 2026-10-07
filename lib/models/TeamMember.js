// lib/models/TeamMember.js
import mongoose from 'mongoose';

const teamMemberSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },

    role: {
      type: String,
      enum: ['owner', 'channel_partner'],
      required: true,
      default: 'channel_partner',
      index: true,
    },


    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      index: true,
    },
    passwordEnc: { type: String, default: '' },   // AES-256-GCM encrypted copy for owner reveal

    // New: bcrypt hash. Preferred.
    passwordHash: { type: String, default: '' },

    // Legacy: plaintext. Optional now — kept only for migration window.
    password: { type: String, default: '' },

    active: { type: Boolean, default: true, index: true },
  },
  { timestamps: true }
);

teamMemberSchema.index({ role: 1, active: 1 });

const TeamMember =
  mongoose.models.TeamMember || mongoose.model('TeamMember', teamMemberSchema);

export default TeamMember;