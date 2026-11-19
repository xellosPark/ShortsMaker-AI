import type { Scene } from './video.types.js';

export interface SampleTopic {
  topic: string;
  emoji: string;
  scenes: Scene[];
}

/** 주제를 정하지 않았을 때 바로 써 볼 수 있는 샘플 대본 */
export const SAMPLE_TOPICS: SampleTopic[] = [
  {
    topic: '잠이 안 올 때 바로 쓰는 4-7-8 호흡법',
    emoji: '😴',
    scenes: [
      { label: '', title: '잠 안 올 때 이것만 하세요', keyword: 'night bedroom', caption: '누워도 잠이 안 온다면, 1분이면 되는 호흡법 하나만 기억하세요.' },
      { label: 'STEP 1', title: '4초 들이쉬기', keyword: 'woman breathing calm', caption: '코로 4초 동안 천천히 숨을 들이마십니다.' },
      { label: 'STEP 2', title: '7초 참기', keyword: 'meditation', caption: '숨을 7초 동안 편하게 참아요.' },
      { label: 'STEP 3', title: '8초 내쉬기', keyword: 'relaxing exhale', caption: '입으로 8초 동안 길게 내쉬면 몸이 이완돼요.' },
      { label: '', title: '딱 4번만 반복', keyword: 'sleeping peacefully', caption: '이걸 네 번만 반복해 보세요. 저장해 두고 오늘 밤 꼭 써 보세요.' },
    ],
  },
  {
    topic: '커피, 하루에 몇 잔까지 괜찮을까?',
    emoji: '☕',
    scenes: [
      { label: '', title: '커피 몇 잔까지 괜찮을까?', keyword: 'coffee pouring', caption: '매일 마시는 커피, 하루에 몇 잔까지 괜찮을까요?' },
      { label: 'POINT 1', title: '카페인 하루 400mg', keyword: 'espresso shot', caption: '식약처 기준 성인 하루 카페인 최대 권고량은 400밀리그램이에요.' },
      { label: 'POINT 2', title: '아메리카노 약 3잔', keyword: 'iced americano', caption: '아메리카노 한 잔에 보통 100에서 150밀리그램, 세 잔 안팎이 기준이에요.' },
      { label: 'POINT 3', title: '늦은 오후엔 줄이기', keyword: 'afternoon sunset cafe', caption: '카페인은 몇 시간 동안 몸에 남아서, 늦은 오후엔 줄이는 게 숙면에 좋아요.' },
      { label: '', title: '내 커피 습관 점검!', keyword: 'coffee cup morning', caption: '오늘 몇 잔 드셨는지 댓글로 알려 주세요.' },
    ],
  },
  {
    topic: '1분 만에 이해하는 복리의 힘',
    emoji: '💰',
    scenes: [
      { label: '', title: '같은 돈인데 왜 차이가 날까?', keyword: 'coins stack', caption: '똑같이 모았는데 누구는 두 배가 되는 이유, 바로 복리 때문이에요.' },
      { label: 'POINT 1', title: '이자에 이자가 붙는다', keyword: 'money growth', caption: '복리는 원금뿐 아니라 이미 받은 이자에도 다시 이자가 붙는 구조예요.' },
      { label: 'POINT 2', title: '72의 법칙', keyword: 'calculator finance', caption: '72를 연 수익률로 나누면, 돈이 두 배가 되는 대략적인 햇수가 나와요.' },
      { label: 'POINT 3', title: '연 6%면 약 12년', keyword: 'growing plant', caption: '연 6퍼센트라면 약 12년 만에 두 배가 됩니다.' },
      { label: '', title: '핵심은 시간', keyword: 'clock time lapse', caption: '그래서 복리의 가장 큰 무기는 일찍 시작하는 거예요.' },
    ],
  },
  {
    topic: '스마트폰 배터리 오래 쓰는 습관 3가지',
    emoji: '🔋',
    scenes: [
      { label: '', title: '배터리 빨리 닳는 이유?', keyword: 'smartphone battery', caption: '스마트폰 배터리, 습관 세 가지만 바꾸면 훨씬 오래 써요.' },
      { label: 'TIP 1', title: '밝기는 자동으로', keyword: 'phone screen brightness', caption: '화면 밝기를 자동으로 두면 배터리 소모가 확 줄어요.' },
      { label: 'TIP 2', title: '20~80% 유지', keyword: 'phone charging', caption: '리튬 이온 배터리는 20에서 80퍼센트 사이를 유지하면 수명에 좋아요.' },
      { label: 'TIP 3', title: '뜨거울 땐 충전 금지', keyword: 'hot summer sun', caption: '열은 배터리의 적이에요. 뜨거운 곳에서는 충전하지 마세요.' },
      { label: '', title: '오늘부터 바로!', keyword: 'using smartphone', caption: '지금 바로 설정에서 밝기부터 바꿔 보세요.' },
    ],
  },
  {
    topic: '집중력 높이는 25분 뽀모도로 공부법',
    emoji: '⏱️',
    scenes: [
      { label: '', title: '집중이 안 된다면?', keyword: 'student studying desk', caption: '책상에 앉아도 집중이 안 된다면, 뽀모도로 기법을 써 보세요.' },
      { label: 'STEP 1', title: '25분 집중', keyword: 'timer focus', caption: '타이머를 25분에 맞추고 딱 한 가지 일만 해요.' },
      { label: 'STEP 2', title: '5분 휴식', keyword: 'coffee break relax', caption: '25분이 끝나면 5분 동안 완전히 쉬어요.' },
      { label: 'STEP 3', title: '4번 뒤엔 긴 휴식', keyword: 'walking park', caption: '이걸 네 번 반복하면 15분에서 30분 정도 길게 쉬어요.' },
      { label: '', title: '오늘 1세트만', keyword: 'writing notebook', caption: '오늘 딱 한 세트만 해 보세요. 생각보다 많이 끝나요.' },
    ],
  },
  {
    topic: '라면 더 맛있게 끓이는 꿀팁',
    emoji: '🍜',
    scenes: [
      { label: '', title: '라면 맛집 비법 공개', keyword: 'ramen noodles', caption: '똑같은 라면도 이렇게 끓이면 맛이 달라져요.' },
      { label: 'TIP 1', title: '물 양은 정확히', keyword: 'boiling water pot', caption: '봉지에 적힌 물 양을 정확히 지키는 게 첫 번째 비법이에요.' },
      { label: 'TIP 2', title: '면을 들었다 놨다', keyword: 'noodles chopsticks', caption: '끓이면서 면을 공기에 들었다 놨다 하면 더 쫄깃해져요.' },
      { label: 'TIP 3', title: '불 끄고 계란', keyword: 'egg cooking', caption: '불을 끈 뒤 계란을 넣으면 국물이 탁해지지 않아요.' },
      { label: '', title: '오늘 저녁은 라면?', keyword: 'eating noodles', caption: '여러분만의 라면 꿀팁도 댓글로 알려 주세요.' },
    ],
  },
];
