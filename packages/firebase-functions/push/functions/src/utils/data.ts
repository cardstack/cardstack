import { firestore } from 'firebase-admin';
import { logger } from 'firebase-functions';
import { IRegistration, IRegistrationOptions } from '../types';

const FIRESTORE_COLLECTION_NAME = 'wallet-connect';

const getCollection = () => {
  return firestore().collection(FIRESTORE_COLLECTION_NAME);
};

export const setRegistration = async (registration: IRegistrationOptions) => {
  try {
    const snapshot = await firestore().collection('wallet-connect').where('topic', '==', registration.topic).get();
    if (snapshot.empty) {
      return getCollection().add({
        ...registration,
        lastMessageTimestamp: firestore.Timestamp.now(),
      });
    } else {
      logger.log('topic exists, update it', registration);
      return await getCollection().doc(snapshot.docs[0].id).update(registration);
    }
  } catch (e) {
    return Promise.reject(e.message);
  }
};

export const getRegistration = async (topic: string): Promise<IRegistration> => {
  try {
    const snapshot = await getCollection().where('topic', '==', topic).get();
    if (snapshot.empty) {
      return Promise.reject('Topic not found.');
    }

    return snapshot.docs[0].data() as IRegistration;
  } catch (e) {
    return Promise.reject(`Error getting topic: ${e}`);
  }
};
