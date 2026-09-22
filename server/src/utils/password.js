import argon2 from "argon2";
import bcrypt from "bcryptjs";

// Argon2id is resistant to GPU cracking and is the single password format
// accepted by new Aadya installations.  Parameters are intentionally explicit
// so they can be reviewed rather than depending on package defaults.
const OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 19 * 1024,
  timeCost: 2,
  parallelism: 1,
};

export function hashPassword(plain) {
  return argon2.hash(plain, OPTIONS);
}

export function verifyPassword(plain, hash) {
  // Existing deployments created before the Argon2id migration may have
  // bcrypt hashes. Keep verification only as a read-compatibility bridge;
  // every newly written password (registration, reset, seed) is Argon2id.
  if (hash.startsWith("$2a$") || hash.startsWith("$2b$") || hash.startsWith("$2y$")) {
    return bcrypt.compare(plain, hash);
  }
  return argon2.verify(hash, plain);
}
