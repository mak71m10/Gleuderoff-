// Родословные Братства Бездны: деревенские семьи острова — Мельник (Гербах) и Дальберг (порт). Братья Колодца не наследуют и семей не имеют.
// Люди-основные (bz-*) созданы в bezdna.mjs — ссылки '@bz-…'.
export const TAG = 'Братство Бездны'
export const RACE = 'Человек (имперец)'
const P = (key, name, g, born, died, father, mother, spouse, title, text, house, secret, role = 'folk') =>
  [key, name, g, born, died, father, mother, spouse, title, text, role, house, secret]

export const SPECS = [
  {
    dyn: 'bz-house-melnik',
    people: [
      P('bzm-greta', 'Грета Мельник', 'f', 972, null, null, null, '@bz-rainer', 'Жена Райнера, сушильщица рыбы', 'Тридцать восемь лет, руки в соли и трещинах; после ночи 1006 г. не говорит о дочери, только сушит рыбу вдвое больше нужного.', 'bz-house-melnik', null),
      P('bzm-per', 'Пер Мельник', 'm', 1002, null, '@bz-rainer', 'bzm-greta', null, 'Младший сын Райнера', 'Восемь лет, ждёт, когда ему стукнет девять — тогда Спуск придёт и за ним. Прячет в кармане камешек.', 'bz-house-melnik', null, 'child'),
    ],
    patch: [['@bz-rainer', { spouse: 'bzm-greta' }], ['@bz-edith', { father: '@bz-rainer', mother: 'bzm-greta' }]],
  },
  {
    dyn: 'bz-house-dalberg',
    people: [
      P('bzd-anselm', 'Ансельм Дальберг', 'm', 984, null, null, '@bz-hanna', null, 'Сын Ханны, брат Второго Спуска', 'Двадцать шесть лет, спустился в 985 г. восьмилетним; в Колодце его зовут Ансельм Ржавый.', 'bz-house-dalberg', 'Мать пытается выкупить его двадцать лет и отправляет вместе с хлебом письма.', 'cleric'),
    ],
    patch: [['@bz-hanna', {}]],
  },
]
