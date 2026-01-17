'use client';

import Image from 'next/image';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export type DeploymentPlatform = 'docker' | 'vercel' | 'railway' | 'netlify' | 'fly-io' | 'render';

interface PlatformOption {
  id: DeploymentPlatform;
  name: string;
  available: boolean;
  logo: string;
}

interface DeploymentTargetSelectorProps {
  selected: DeploymentPlatform;
  onSelect: (platform: DeploymentPlatform) => void;
  className?: string;
}

const platforms: PlatformOption[] = [
  { id: 'docker', name: 'Docker', available: true, logo: '/deployment-target/docker.svg' },
  { id: 'vercel', name: 'Vercel', available: false, logo: '/deployment-target/vercel.svg' },
  { id: 'railway', name: 'Railway', available: false, logo: '/deployment-target/railway.svg' },
  { id: 'netlify', name: 'Netlify', available: false, logo: '/deployment-target/netlify.svg' },
  { id: 'fly-io', name: 'Fly.io', available: false, logo: '/deployment-target/fly.io.svg' },
  { id: 'render', name: 'Render', available: false, logo: '/deployment-target/render.svg' },
];

export function DeploymentTargetSelector({
  selected,
  onSelect,
  className,
}: DeploymentTargetSelectorProps) {
  return (
    <div className={cn('space-y-3', className)}>
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
        {platforms.map((platform) => {
          const isSelected = selected === platform.id;
          const isDisabled = !platform.available;

          return (
            <div
              key={platform.id}
              className={cn(
                'relative flex flex-col items-center p-3 rounded-lg cursor-pointer transition-all border',
                isSelected && 'bg-ocean-50 border-ocean-300',
                isDisabled && 'opacity-50 cursor-not-allowed border-transparent',
                !isDisabled && !isSelected && 'hover:bg-gray-50 border-transparent'
              )}
              onClick={() => {
                if (platform.available) {
                  onSelect(platform.id);
                }
              }}
            >
              <Image
                src={platform.logo}
                alt={`${platform.name} logo`}
                width={28}
                height={28}
                className="h-7 w-7"
              />
              <span
                className={cn(
                  'text-xs mt-1.5 font-medium',
                  isSelected ? 'text-ocean-700' : 'text-gray-600'
                )}
              >
                {platform.name}
              </span>
              {isDisabled && (
                <Badge
                  variant="secondary"
                  className="text-[10px] px-1.5 py-0 mt-1 bg-gray-100 text-gray-500"
                >
                  Soon
                </Badge>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
