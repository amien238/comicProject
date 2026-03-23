export type UserTierBadge = {
  key: string;
  label: string;
  className: string;
};

export const resolveUserTier = (role?: string, totalDeposited?: number): UserTierBadge | null => {
  const safeRole = String(role || '').toUpperCase();

  if (safeRole === 'ADMIN') {
    return { key: 'ADMIN', label: 'Admin', className: 'bg-red-500 text-white' };
  }

  if (safeRole === 'AUTHOR') {
    return { key: 'AUTHOR', label: 'Author', className: 'bg-purple-500 text-white' };
  }

  if (safeRole === 'ACCOUNTER') {
    return { key: 'ACCOUNTER', label: 'Accounter', className: 'bg-amber-600 text-white' };
  }

  const total = Number(totalDeposited || 0);
  if (total < 50000) return null;
  if (total >= 5000000) return { key: 'PHU_BA', label: 'Phú bà', className: 'bg-yellow-400 text-black font-black' };
  if (total >= 2000000) return { key: 'CAP_5', label: 'Cấp 5', className: 'bg-orange-500 text-white' };
  if (total >= 1000000) return { key: 'CAP_4', label: 'Cấp 4', className: 'bg-pink-500 text-white' };
  if (total >= 500000) return { key: 'CAP_3', label: 'Cấp 3', className: 'bg-blue-500 text-white' };
  if (total >= 200000) return { key: 'CAP_2', label: 'Cấp 2', className: 'bg-green-500 text-white' };
  return { key: 'CAP_1', label: 'Cấp 1', className: 'bg-slate-500 text-white' };
};
