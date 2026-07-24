'use strict';

const bcrypt = require('bcryptjs');
const { sequelize, User } = require('../models');

async function main() {
  if (process.env.ALLOW_SCHEMA_MIGRATION !== 'true') throw new Error('ALLOW_SCHEMA_MIGRATION=true is required');
  await sequelize.sync({ alter: false });
  const email = process.env.PROVISION_ADMIN_EMAIL;
  const password = process.env.PROVISION_ADMIN_PASSWORD;
  const name = process.env.PROVISION_ADMIN_NAME || 'Runtime Administrator';
  if (!email || !password) throw new Error('Provisioned administrator credentials are required');
  await User.upsert({ email, password: await bcrypt.hash(password, 12), name, role: 'admin' });
}

main().then(() => sequelize.close()).catch(async (error) => {
  console.error(error.message);
  await sequelize.close().catch(() => {});
  process.exit(1);
});
