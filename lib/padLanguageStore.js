'use strict';

const DB = require('ep_etherpad-lite/node/db/DB');
const allowlist = require('./languageAllowlist');

const key = (padId) => `pad:${padId}:syntax`;

const DEFAULT = Object.freeze({language: 'auto', autoDetect: true});

const get = async (padId) => {
  const raw = await DB.db.get(key(padId));
  if (!raw || typeof raw !== 'object') return {...DEFAULT};
  const language = typeof raw.language === 'string' ? raw.language : DEFAULT.language;
  const autoDetect = raw.autoDetect !== false;
  return {language, autoDetect};
};

const set = async (padId, {language, autoDetect}) => {
  if (!allowlist.isSupported(language)) {
    throw new Error(`unsupported language: ${language}`);
  }
  await DB.db.set(key(padId), {language, autoDetect: !!autoDetect});
};

const remove = async (padId) => { await DB.db.remove(key(padId)); };

module.exports = {get, set, remove, key, DEFAULT};
