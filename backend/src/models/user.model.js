import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const userSchema = new mongoose.Schema(
  {
    clerkId: {
      type: String,
      required: true,
      unique: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
    },
    name: {
      type: String,
      required: true,
    },
    avatar: {
      type: String,
      required: true,
    },
    username: {
      type: String,
      unique: true,
      sparse: true,
    },
    password: {
      type: String,
      required: false,
    },
  },
  { timestamps: true }
);

// Хешируем пароль перед сохранением, если он новый или изменён
userSchema.pre("save", function (next) {
  if (!this.isModified("password") || !this.password) return next();
  try {
    const salt = bcrypt.genSaltSync(10);
    this.password = bcrypt.hashSync(this.password, salt);
    return next();
  } catch (err) {
    return next(err);
  }
});

// Метод экземпляра для сравнения пароля
userSchema.methods.comparePassword = function (candidatePassword) {
  if (!this.password) return false;
  return bcrypt.compareSync(candidatePassword, this.password);
};

export const User = mongoose.model("User", userSchema);
