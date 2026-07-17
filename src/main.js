import './style.css';
import {
  createElement,
  Heart,
  LogIn,
  LogOut,
  MessageCircle,
  PawPrint,
  Send,
  Shuffle,
  Trash2,
  TriangleAlert,
} from 'lucide';
import { initializeApp } from 'firebase/app';
import { getAnalytics, isSupported } from 'firebase/analytics';
import {
  browserLocalPersistence,
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  setPersistence,
  signInWithPopup,
  signOut,
} from 'firebase/auth';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getFirestore,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
} from 'firebase/firestore';

const ADMIN_EMAILS = ['mkimhigh@gmail.com'];

const firebaseConfig = {
  apiKey: 'AIzaSyAhfVfciC3toDN7BwX2zzXS-kQLVa4oSUw',
  authDomain: 'my-web-556f0.firebaseapp.com',
  projectId: 'my-web-556f0',
  storageBucket: 'my-web-556f0.firebasestorage.app',
  messagingSenderId: '703520645673',
  appId: '1:703520645673:web:890cee8137ec040d4eb238',
  measurementId: 'G-YZ9M16CMFS',
};

const animalSources = {
  dog: {
    label: '강아지',
    title: '느긋한 강아지 한 장',
    provider: 'Dog CEO',
    providerUrl: 'https://dog.ceo/dog-api/',
    getPhoto: async (signal) => {
      const response = await fetch('https://dog.ceo/api/breeds/image/random', { signal });
      if (!response.ok) throw new Error('Dog API request failed');
      const data = await response.json();
      return data.message;
    },
  },
  cat: {
    label: '고양이',
    title: '새침한 고양이 한 장',
    provider: 'The Cat API',
    providerUrl: 'https://thecatapi.com/',
    getPhoto: async (signal) => {
      const response = await fetch('https://api.thecatapi.com/v1/images/search', { signal });
      if (!response.ok) throw new Error('Cat API request failed');
      const [photo] = await response.json();
      if (!photo?.url) throw new Error('Cat API returned no image');
      return photo.url;
    },
  },
  fox: {
    label: '여우',
    title: '숲에서 온 여우 한 장',
    provider: 'RandomFox',
    providerUrl: 'https://randomfox.ca/',
    getPhoto: async (signal) => {
      const response = await fetch('https://randomfox.ca/floof/', { signal });
      if (!response.ok) throw new Error('Fox API request failed');
      const data = await response.json();
      if (!data.image) throw new Error('Fox API returned no image');
      return data.image;
    },
  },
};

const animalTypes = Object.keys(animalSources);
const favoriteAnimalLabels = {
  dog: '강아지',
  cat: '고양이',
  fox: '여우',
};
const photoStage = document.querySelector('#photo-stage');
const photo = document.querySelector('#animal-photo');
const animalLabel = document.querySelector('#animal-label');
const photoTitle = document.querySelector('#photo-title');
const photoStatus = document.querySelector('#photo-status');
const sourceLink = document.querySelector('#source-link');
const errorMessage = document.querySelector('#error-message');
const nextButton = document.querySelector('#next-photo');
const retryButton = document.querySelector('#retry-photo');
const filterButtons = [...document.querySelectorAll('[data-animal]')];

let selectedAnimal = 'random';
let lastRandomAnimal = null;
let requestController = null;

document.querySelector('#brand-icon').append(createElement(PawPrint, { width: 22, height: 22 }));
document.querySelector('#shuffle-icon').append(createElement(Shuffle, { width: 20, height: 20 }));
document.querySelector('#send-icon').append(createElement(Send, { width: 19, height: 19 }));
document.querySelector('#heart-icon').append(createElement(Heart, { width: 19, height: 19 }));
document.querySelector('#placeholder-icon').append(createElement(PawPrint, { width: 42, height: 42 }));
document.querySelector('#form-paw-icon').append(createElement(PawPrint, { width: 21, height: 21 }));
document.querySelector('#login-icon').append(createElement(LogIn, { width: 17, height: 17 }));
document.querySelector('#logout-icon').append(createElement(LogOut, { width: 16, height: 16 }));
document.querySelector('#delete-dialog-icon').append(
  createElement(TriangleAlert, { width: 26, height: 26 }),
);
document.querySelector('#message-circle-icon').append(
  createElement(MessageCircle, { width: 24, height: 24 }),
);

function getRandomAnimal() {
  const choices = animalTypes.filter((type) => type !== lastRandomAnimal);
  const type = choices[Math.floor(Math.random() * choices.length)];
  lastRandomAnimal = type;
  return type;
}

function preloadImage(url, signal) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const abort = () => reject(new DOMException('Aborted', 'AbortError'));

    image.onload = () => {
      signal.removeEventListener('abort', abort);
      resolve();
    };
    image.onerror = () => {
      signal.removeEventListener('abort', abort);
      reject(new Error('Image failed to load'));
    };
    signal.addEventListener('abort', abort, { once: true });
    image.referrerPolicy = 'no-referrer';
    image.src = url;
  });
}

async function loadPhoto() {
  requestController?.abort();
  requestController = new AbortController();
  const { signal } = requestController;
  const animalType = selectedAnimal === 'random' ? getRandomAnimal() : selectedAnimal;
  const source = animalSources[animalType];

  photoStage.classList.add('is-loading');
  photoStage.setAttribute('aria-busy', 'true');
  errorMessage.hidden = true;
  nextButton.disabled = true;
  photoStatus.textContent = `${source.label} 사진을 불러오는 중입니다.`;

  try {
    const imageUrl = await source.getPhoto(signal);
    await preloadImage(imageUrl, signal);

    photo.src = imageUrl;
    photo.alt = `무작위로 선택된 ${source.label} 사진`;
    animalLabel.textContent = source.label;
    photoTitle.textContent = source.title;
    sourceLink.textContent = source.provider;
    sourceLink.href = source.providerUrl;
    photoStage.classList.remove('is-loading');
    photoStatus.textContent = `새로운 ${source.label} 사진을 표시했습니다.`;
  } catch (error) {
    if (error.name === 'AbortError') return;
    photoStage.classList.remove('is-loading');
    errorMessage.hidden = false;
    photoStatus.textContent = '사진을 불러오지 못했습니다. 다시 시도해 주세요.';
  } finally {
    if (!signal.aborted) {
      photoStage.setAttribute('aria-busy', 'false');
      nextButton.disabled = false;
    }
  }
}

filterButtons.forEach((button) => {
  button.addEventListener('click', () => {
    selectedAnimal = button.dataset.animal;
    filterButtons.forEach((item) => {
      item.setAttribute('aria-pressed', String(item === button));
    });
    loadPhoto();
  });
});

nextButton.addEventListener('click', loadPhoto);
retryButton.addEventListener('click', loadPhoto);

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });
const firebaseStatus = document.querySelector('#firebase-status');

const guestbookForm = document.querySelector('#guestbook-form');
const nameInput = document.querySelector('#guest-name');
const favoriteAnimalSelect = document.querySelector('#favorite-animal');
const messageInput = document.querySelector('#guest-message');
const nameError = document.querySelector('#name-error');
const favoriteAnimalError = document.querySelector('#favorite-animal-error');
const messageError = document.querySelector('#message-error');
const messageCount = document.querySelector('#message-count');
const submitButton = document.querySelector('#guestbook-submit');
const submitLabel = document.querySelector('#submit-label');
const formStatus = document.querySelector('#guestbook-form-status');
const guestbookCount = document.querySelector('#guestbook-count');
const guestbookLoading = document.querySelector('#guestbook-loading');
const guestbookEmpty = document.querySelector('#guestbook-empty');
const guestbookError = document.querySelector('#guestbook-error');
const guestbookErrorDetail = document.querySelector('#guestbook-error-detail');
const guestbookList = document.querySelector('#guestbook-list');
const adminLoginButton = document.querySelector('#admin-login');
const adminLogoutButton = document.querySelector('#admin-logout');
const adminSession = document.querySelector('#admin-session');
const adminAuthStatus = document.querySelector('#admin-auth-status');
const deleteDialog = document.querySelector('#delete-dialog');
const deleteDialogDescription = document.querySelector('#delete-dialog-description');
const deleteCancelButton = document.querySelector('#delete-cancel');
const deleteConfirmButton = document.querySelector('#delete-confirm');

const guestbookCollection = collection(db, 'guestbook');
const guestbookQuery = query(guestbookCollection, orderBy('createdAt', 'desc'), limit(50));
const dateFormatter = new Intl.DateTimeFormat('ko-KR', {
  month: 'short',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

let isAdmin = false;
let latestGuestbookSnapshot = null;
let pendingDeleteId = null;

function isAdminAccount(user) {
  return Boolean(
    user?.emailVerified && ADMIN_EMAILS.includes(user.email?.toLowerCase()),
  );
}

function setAdminStatus(message, state = '') {
  adminAuthStatus.textContent = message;
  adminAuthStatus.className = 'admin-auth-status';
  if (state) adminAuthStatus.classList.add(state);
}

function updateAdminUi(user) {
  isAdmin = isAdminAccount(user);
  adminLoginButton.hidden = isAdmin;
  adminSession.hidden = !isAdmin;
  document.body.classList.toggle('is-admin', isAdmin);

  if (isAdmin) {
    adminSession.querySelector('.admin-badge').title = user.email;
    setAdminStatus(`${user.email} 관리자 계정으로 로그인했습니다.`, 'is-success');
  }

  if (latestGuestbookSnapshot) renderGuestbook(latestGuestbookSnapshot);
}

function setFirebaseStatus(message, state = '') {
  firebaseStatus.textContent = message;
  firebaseStatus.classList.remove('is-connected', 'is-error');
  if (state) firebaseStatus.classList.add(state);
}

function getFirestoreErrorMessage(error) {
  if (error?.code === 'permission-denied') {
    return 'Firestore 보안 규칙에서 guestbook 읽기·쓰기 권한을 확인해 주세요.';
  }
  if (error?.code === 'unavailable') {
    return '네트워크 연결이 원활하지 않아요. 연결 후 다시 시도해 주세요.';
  }
  return '잠시 후 새로고침해 주세요.';
}

function formatCreatedAt(timestamp, pending) {
  if (pending || !timestamp?.toDate) return '등록 중…';
  return dateFormatter.format(timestamp.toDate());
}

function renderGuestbook(snapshot) {
  const fragment = document.createDocumentFragment();

  snapshot.docs.forEach((documentSnapshot) => {
    const entry = documentSnapshot.data();
    const isPending = documentSnapshot.metadata.hasPendingWrites;
    const item = document.createElement('li');
    const header = document.createElement('div');
    const meta = document.createElement('div');
    const authorGroup = document.createElement('div');
    const author = document.createElement('strong');
    const time = document.createElement('time');
    const message = document.createElement('p');

    item.className = 'guestbook-entry';
    if (isPending) item.classList.add('is-pending');
    author.textContent = entry.name || '이름 없는 방문자';
    time.textContent = formatCreatedAt(entry.createdAt, isPending);
    if (entry.createdAt?.toDate) time.dateTime = entry.createdAt.toDate().toISOString();
    message.textContent = entry.message || '';
    authorGroup.className = 'guestbook-entry-author';
    authorGroup.append(author);

    if (favoriteAnimalLabels[entry.favoriteAnimal]) {
      const favoriteAnimal = document.createElement('span');
      favoriteAnimal.className = 'favorite-animal-badge';
      favoriteAnimal.append(createElement(Heart, { width: 13, height: 13 }));
      favoriteAnimal.append(`최애 ${favoriteAnimalLabels[entry.favoriteAnimal]}`);
      authorGroup.append(favoriteAnimal);
    }

    meta.className = 'guestbook-entry-meta';
    meta.append(authorGroup, time);
    header.append(meta);

    if (isAdmin && !isPending) {
      const deleteButton = document.createElement('button');
      deleteButton.className = 'guestbook-delete';
      deleteButton.type = 'button';
      deleteButton.dataset.entryId = documentSnapshot.id;
      deleteButton.dataset.author = entry.name || '이름 없는 방문자';
      deleteButton.setAttribute(
        'aria-label',
        `${entry.name || '이름 없는 방문자'}님의 방명록 삭제`,
      );
      deleteButton.append(createElement(Trash2, { width: 16, height: 16 }));
      header.append(deleteButton);
    }

    item.append(header, message);
    fragment.append(item);
  });

  guestbookList.replaceChildren(fragment);
  guestbookLoading.hidden = true;
  guestbookError.hidden = true;
  guestbookEmpty.hidden = !snapshot.empty;
  guestbookCount.textContent = `${snapshot.size}개의 메시지`;
}

setPersistence(auth, browserLocalPersistence).catch(() => {
  setAdminStatus('로그인 상태를 저장하지 못했습니다. 다시 로그인해 주세요.', 'is-error');
});

onAuthStateChanged(auth, async (user) => {
  if (user && !isAdminAccount(user)) {
    const email = user.email || '선택한 계정';
    await signOut(auth);
    updateAdminUi(null);
    setAdminStatus(`${email}은 등록된 관리자 계정이 아닙니다.`, 'is-error');
    return;
  }

  updateAdminUi(user);
});

adminLoginButton.addEventListener('click', async () => {
  adminLoginButton.disabled = true;
  setAdminStatus('Google 관리자 로그인을 진행하고 있습니다.');

  try {
    await signInWithPopup(auth, googleProvider);
  } catch (error) {
    if (error?.code === 'auth/popup-closed-by-user') {
      setAdminStatus('로그인이 취소되었습니다.');
    } else if (error?.code === 'auth/operation-not-allowed') {
      setAdminStatus('Firebase Authentication에서 Google 로그인을 활성화해 주세요.', 'is-error');
    } else {
      setAdminStatus('관리자 로그인에 실패했습니다. 잠시 후 다시 시도해 주세요.', 'is-error');
    }
  } finally {
    adminLoginButton.disabled = false;
  }
});

adminLogoutButton.addEventListener('click', async () => {
  await signOut(auth);
  updateAdminUi(null);
  setAdminStatus('관리자 계정에서 로그아웃했습니다.');
});

guestbookList.addEventListener('click', (event) => {
  const deleteButton = event.target.closest('.guestbook-delete');
  if (!deleteButton || !isAdmin) return;

  pendingDeleteId = deleteButton.dataset.entryId;
  deleteDialogDescription.textContent = `${deleteButton.dataset.author}님의 메시지를 삭제합니다. 삭제 후에는 복구할 수 없습니다.`;
  deleteDialog.showModal();
});

deleteCancelButton.addEventListener('click', () => {
  pendingDeleteId = null;
  deleteDialog.close();
});

deleteDialog.addEventListener('cancel', () => {
  pendingDeleteId = null;
});

deleteConfirmButton.addEventListener('click', async () => {
  if (!pendingDeleteId || !isAdmin) return;

  deleteConfirmButton.disabled = true;
  deleteConfirmButton.textContent = '삭제 중…';

  try {
    await deleteDoc(doc(db, 'guestbook', pendingDeleteId));
    deleteDialog.close();
    setAdminStatus('방명록 메시지를 삭제했습니다.', 'is-success');
    pendingDeleteId = null;
  } catch (error) {
    setAdminStatus(
      error?.code === 'permission-denied'
        ? '관리자 삭제 권한을 확인해 주세요.'
        : '메시지를 삭제하지 못했습니다. 다시 시도해 주세요.',
      'is-error',
    );
    deleteDialog.close();
  } finally {
    deleteConfirmButton.disabled = false;
    deleteConfirmButton.textContent = '삭제하기';
  }
});

function validateGuestbookForm() {
  const name = nameInput.value.trim();
  const favoriteAnimal = favoriteAnimalSelect.value;
  const message = messageInput.value.trim();
  let firstInvalidField = null;

  nameError.textContent = '';
  favoriteAnimalError.textContent = '';
  messageError.textContent = '';
  nameInput.removeAttribute('aria-invalid');
  favoriteAnimalSelect.removeAttribute('aria-invalid');
  messageInput.removeAttribute('aria-invalid');

  if (!name) {
    nameError.textContent = '이름을 입력해 주세요.';
    nameInput.setAttribute('aria-invalid', 'true');
    firstInvalidField = nameInput;
  }

  if (!favoriteAnimalLabels[favoriteAnimal]) {
    favoriteAnimalError.textContent = '최애 동물을 선택해 주세요.';
    favoriteAnimalSelect.setAttribute('aria-invalid', 'true');
    firstInvalidField ??= favoriteAnimalSelect;
  }

  if (!message) {
    messageError.textContent = '메시지를 입력해 주세요.';
    messageInput.setAttribute('aria-invalid', 'true');
    firstInvalidField ??= messageInput;
  }

  if (firstInvalidField) {
    firstInvalidField.focus();
    return null;
  }

  return { name, favoriteAnimal, message };
}

favoriteAnimalSelect.addEventListener('change', () => {
  if (favoriteAnimalLabels[favoriteAnimalSelect.value]) {
    favoriteAnimalError.textContent = '';
    favoriteAnimalSelect.removeAttribute('aria-invalid');
  }
});

messageInput.addEventListener('input', () => {
  messageCount.textContent = `${messageInput.value.length} / 300`;
  if (messageInput.value.trim()) {
    messageError.textContent = '';
    messageInput.removeAttribute('aria-invalid');
  }
});

nameInput.addEventListener('input', () => {
  if (nameInput.value.trim()) {
    nameError.textContent = '';
    nameInput.removeAttribute('aria-invalid');
  }
});

guestbookForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const values = validateGuestbookForm();
  if (!values) return;

  submitButton.disabled = true;
  submitLabel.textContent = '등록 중…';
  formStatus.textContent = '';
  formStatus.className = 'form-status';

  try {
    await addDoc(guestbookCollection, {
      name: values.name,
      favoriteAnimal: values.favoriteAnimal,
      message: values.message,
      createdAt: serverTimestamp(),
    });
    guestbookForm.reset();
    messageCount.textContent = '0 / 300';
    formStatus.textContent = '방명록을 남겼어요. 고맙습니다!';
    formStatus.classList.add('is-success');
    messageInput.focus();
  } catch (error) {
    formStatus.textContent = getFirestoreErrorMessage(error);
    formStatus.classList.add('is-error');
  } finally {
    submitButton.disabled = false;
    submitLabel.textContent = '방명록 남기기';
  }
});

onSnapshot(
  guestbookQuery,
  { includeMetadataChanges: true },
  (snapshot) => {
    latestGuestbookSnapshot = snapshot;
    renderGuestbook(snapshot);
    setFirebaseStatus(
      snapshot.metadata.fromCache ? '오프라인 데이터 표시 중' : 'Firestore 연결됨',
      snapshot.metadata.fromCache ? '' : 'is-connected',
    );
  },
  (error) => {
    guestbookLoading.hidden = true;
    guestbookEmpty.hidden = true;
    guestbookError.hidden = false;
    guestbookErrorDetail.textContent = getFirestoreErrorMessage(error);
    setFirebaseStatus('Firestore 연결 오류', 'is-error');
  },
);

isSupported()
  .then((supported) => {
    if (supported) getAnalytics(app);
  })
  .catch(() => {});

loadPhoto();
