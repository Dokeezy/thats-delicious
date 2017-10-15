var mongoose = require('mongoose');
// Change mongoose promise to ES6 promise (Async/Await)
mongoose.Promise = global.Promise;
const slug = require('slugs');

const storeSchema = new mongoose.Schema({
  name: {
    type: String,
    trim: true,
    // By writting a string it assumes that the value is true
    // And the error thrown will be the string
    required: 'Please, enter a store name !'
  },
  slug: String,
  description: {
    type: String,
    trim: true
  },
  tags: [String],
  created: {
    type: Date,
    default: Date.now
  },
  location: {
    type:  {
      type: String,
      default: 'Point'
    },
    coordinates: [{
      type: Number,
      required: 'You must supply coordinates !'
    }],
    address: {
      type: String,
      required: 'You must supply an address !'
    }
  },
  photo: String,
  author: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: 'You must supply an author.'
  }
}, {
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Define indexes

storeSchema.index({
  name: 'text',
  description: 'text'
});

storeSchema.index({ location: '2dsphere' });

storeSchema.pre('save', async function(next) {
  if (!this.isModified('name')) {
    next();
    return;
  }
  this.slug = slug(this.name);
  const slugRegEx = new RegExp(`^(${this.slug})((-[0-9]*$)?)$`, 'i');
  const storesWithSlug = await this.constructor.find({ slug: slugRegEx });
  if (storesWithSlug.length) {
    this.slug = `${this.slug}-${storesWithSlug.length}`;
  }
  next();
});

storeSchema.statics.getTagsList = function() {
  return this.aggregate([
    { $unwind: '$tags' },
    { $group: { _id: '$tags', count: { $sum: 1 } }},
    { $sort: { count: -1 }}
  ]);
}

storeSchema.statics.getTopStores = function() {
  return this.aggregate([
    // Find stores and populate their reviews
    { $lookup: {
        from: 'reviews',
        localField: '_id',
        foreignField: 'store',
        as: 'reviews'
      }
    },
    // Filter : only 2 reviews or more
    // Return only if reviews[1] item exists
    { $match: { 'reviews.1': { $exists: true } } },
    // Add the average rating field
    { $project: {
      photo: '$$ROOT.photo',
      name: '$$ROOT.name',
      reviews: '$$ROOT.reviews',
      slug: '$$ROOT.slug',
      averageRating: { $avg: '$reviews.rating' }
    }},
    // Sort by highest reviews
    { $sort: { averageRating: -1 } },
    { $limit: 10 }
  ]);
}

// Link reviews where the stores._id === reviews.store
storeSchema.virtual('reviews', {
  ref: 'Review', // What model to link ?
  localField: '_id', // Which field on the store ?
  foreignField: 'store' // Which field on the review ?
});

function autopopulate(next) {
  this.populate('reviews');
  next();
}

storeSchema.pre('find', autopopulate);
storeSchema.pre('findOne', autopopulate);

module.exports = mongoose.model('Store', storeSchema);
