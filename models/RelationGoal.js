const mongoose = require('mongoose');

const relationGoalSchema = new mongoose.Schema({
    title: { type: String, required: true, trim: true, unique: true },
    subtitle: { type: String, default: '' },
    status: { type: Number, enum: [0, 1], default: 1 },
    sortOrder: { type: Number, default: 0 },
}, { timestamps: true });

module.exports = mongoose.model('RelationGoal', relationGoalSchema);
