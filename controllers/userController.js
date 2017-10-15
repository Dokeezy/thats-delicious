const mongoose = require('mongoose');
const User = mongoose.model('User');
const Store = mongoose.model('Store');
const promisify = require('es6-promisify');
const multer = require('multer');
const jimp = require('jimp');
const uuid = require('uuid');

const multerOptions = {
  storage: multer.memoryStorage(),
  fileFilter(req, file, next) {
    const isPhoto = file.mimetype.startsWith('image/');
    if (isPhoto) {
      next(null, true);
    } else {
      next({ message: "That filetype isn't allowed !" }, false);
    }
  }
}

exports.upload = multer(multerOptions).single('photo');

exports.resize = async (req, res, next) => {
  // If there is no new file to resize: next
  if (!req.file) {
    next();
    return;
  }
  // Creating a new unique name for the photo
  const extension = req.file.mimetype.split('/')[1];
  req.body.photo = `${uuid.v4()}.${extension}`;
  // Now resizing the photo
  const photo = await jimp.read(req.file.buffer);
  await photo.resize(300, jimp.AUTO);
  await photo.write(`./public/uploads/${req.body.photo}`);
  next();
}

exports.loginForm = (req, res) => {
  res.render('login', { title: 'Login' });
}

exports.registerForm = (req, res) => {
  res.render('register', { title: 'Register' });
}

exports.validateRegister = (req, res, next) => {
  req.sanitizeBody('name');
  req.checkBody('name', 'You must supply a name !').notEmpty();
  req.checkBody('email', 'The email is not valid !').isEmail();
  req.sanitizeBody('email').normalizeEmail({
    remove_dots: false,
    remove_extention: false,
    gmail_remove_subaddress: false
  });
  req.checkBody('password', 'Password cannot be blank !').notEmpty();
  req.checkBody('password-confirm', 'Confirmed password cannot be blank !').notEmpty();
  req.checkBody('password-confirm', 'Oops ! Your passwords do not match.').equals(req.body.password);

  const errors = req.validationErrors();
  if (errors) {
    req.flash('error', errors.map(error => error.msg));
    res.render('register', { title: 'Register', body: req.body, flashes: req.flash() });
    return;
  }
  next();
}

exports.register = async (req, res, next) => {
  const user = new User({ email: req.body.email, name: req.body.name, photo: req.body.photo });
  // Register method from passport doesn't support Promises
  // So we use promisify to make promises available to this method
  const register = promisify(User.register, User);
  await register(user, req.body.password);
  next();
}

exports.account = (req, res) => {
  res.render('account', { title: 'Your Account' });
}

exports.updateAccount = async (req, res) => {
  const updates = {
    name: req.body.name,
    email: req.body.email
  }

  if (req.body.photo) {
    updates.photo = req.body.photo;
  }

  const user = await User.findOneAndUpdate(
    { _id: req.user._id },
    { $set: updates },
    { new: true, runValidators: true, context: 'query' }
  );
  req.flash('success', 'Successfully updated your account.');
  res.redirect('back');
}
