import { For, Show } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import { Card, Badge, Icon } from '@bolh/ui';

interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  points: number;
  progress: number;
  maxProgress: number;
  unlocked: boolean;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
}

const achievements: Achievement[] = [
  {
    id: '1',
    title: 'First Order',
    description: 'Complete your first order',
    icon: 'shield',
    points: 100,
    progress: 1,
    maxProgress: 1,
    unlocked: true,
    rarity: 'common',
  },
  {
    id: '2',
    title: 'Regular Customer',
    description: 'Complete 10 orders',
    icon: 'star',
    points: 500,
    progress: 7,
    maxProgress: 10,
    unlocked: false,
    rarity: 'rare',
  },
  {
    id: '3',
    title: 'Night Owl',
    description: 'Book a guard after midnight',
    icon: 'star',
    points: 200,
    progress: 1,
    maxProgress: 1,
    unlocked: true,
    rarity: 'rare',
  },
  {
    id: '4',
    title: 'Safety First',
    description: 'Use SOS button',
    icon: 'sos',
    points: 50,
    progress: 0,
    maxProgress: 1,
    unlocked: false,
    rarity: 'common',
  },
  {
    id: '5',
    title: 'VIP Client',
    description: 'Spend over 500,000 ₸',
    icon: 'heart',
    points: 1000,
    progress: 234000,
    maxProgress: 500000,
    unlocked: false,
    rarity: 'epic',
  },
  {
    id: '6',
    title: 'Legend',
    description: 'Complete 100 orders',
    icon: 'shield',
    points: 5000,
    progress: 12,
    maxProgress: 100,
    unlocked: false,
    rarity: 'legendary',
  },
];

const totalPoints = achievements.filter(a => a.unlocked).reduce((sum, a) => sum + a.points, 0);
const level = Math.floor(totalPoints / 500) + 1;
const levelProgress = (totalPoints % 500) / 500 * 100;

export default function AchievementsPage() {
  const navigate = useNavigate();

  const rarityColors = {
    common: 'bg-gray-500',
    rare: 'bg-blue-500',
    epic: 'bg-purple-500',
    legendary: 'bg-yellow-500',
  };

  return (
    <div class="px-4 py-6 pb-20">
      {/* Header */}
      <div class="flex items-center gap-3 mb-6">
        <button onClick={() => navigate(-1)}>
          <Icon name="arrowLeft" size="md" />
        </button>
        <h1 class="text-xl font-bold text-gray-900">Achievements</h1>
      </div>

      {/* Level card */}
      <Card class="bg-gradient-to-r from-blue-600 to-purple-600 text-white mb-6">
        <div class="text-center">
          <div class="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-3">
            <span class="text-3xl font-bold">{level}</span>
          </div>
          <h2 class="text-xl font-bold">Level {level}</h2>
          <p class="text-sm opacity-80">{totalPoints} points earned</p>
          
          <div class="mt-4">
            <div class="flex justify-between text-sm mb-1">
              <span>{totalPoints % 500} / 500 to next level</span>
            </div>
            <div class="h-2 bg-white/20 rounded-full overflow-hidden">
              <div 
                class="h-full bg-white rounded-full transition-all duration-500"
                style={{ width: `${levelProgress}%` }}
              />
            </div>
          </div>
        </div>
      </Card>

      {/* Stats */}
      <div class="grid grid-cols-3 gap-3 mb-6">
        <Card class="text-center py-3">
          <p class="text-2xl font-bold text-blue-600">
            {achievements.filter(a => a.unlocked).length}
          </p>
          <p class="text-xs text-gray-500">Unlocked</p>
        </Card>
        <Card class="text-center py-3">
          <p class="text-2xl font-bold text-gray-600">
            {achievements.length - achievements.filter(a => a.unlocked).length}
          </p>
          <p class="text-xs text-gray-500">Locked</p>
        </Card>
        <Card class="text-center py-3">
          <p class="text-2xl font-bold text-purple-600">{totalPoints}</p>
          <p class="text-xs text-gray-500">Points</p>
        </Card>
      </div>

      {/* Achievements list */}
      <div class="space-y-3">
        <For each={achievements}>
          {(achievement) => (
            <Card class={achievement.unlocked ? '' : 'opacity-60'}>
              <div class="flex items-center gap-4">
                <div class={`w-14 h-14 rounded-xl ${rarityColors[achievement.rarity]} flex items-center justify-center`}>
                  <Icon name={achievement.icon} size="lg" class="text-white" />
                </div>
                
                <div class="flex-1">
                  <div class="flex items-center gap-2">
                    <h3 class="font-semibold text-gray-900">{achievement.title}</h3>
                    <Show when={achievement.unlocked}>
                      <Icon name="check" size="sm" class="text-green-500" />
                    </Show>
                  </div>
                  <p class="text-sm text-gray-500">{achievement.description}</p>
                  
                  <Show when={!achievement.unlocked && achievement.progress > 0}>
                    <div class="mt-2">
                      <div class="flex justify-between text-xs text-gray-400 mb-1">
                        <span>{achievement.progress.toLocaleString()} / {achievement.maxProgress.toLocaleString()}</span>
                      </div>
                      <div class="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                        <div 
                          class="h-full bg-blue-500 rounded-full"
                          style={{ width: `${(achievement.progress / achievement.maxProgress) * 100}%` }}
                        />
                      </div>
                    </div>
                  </Show>
                </div>

                <div class="text-right">
                  <Badge 
                    variant={achievement.unlocked ? 'success' : 'default'}
                    size="sm"
                  >
                    +{achievement.points}
                  </Badge>
                  <p class="text-xs text-gray-400 mt-1 capitalize">{achievement.rarity}</p>
                </div>
              </div>
            </Card>
          )}
        </For>
      </div>
    </div>
  );
}
