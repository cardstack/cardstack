import { urlAlphabet, customAlphabet } from 'nanoid';

// Use the default nanoid alphabet, but remove dashes, as that's our deliminator
export const nanoid = customAlphabet(urlAlphabet.replace('-', ''), 15);
