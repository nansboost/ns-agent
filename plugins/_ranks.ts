// @ts-nocheck
global.rpg = {
  role(level) {
    level = parseInt(level)
    if (isNaN(level)) return { name: 'Unknown', level: '' }

    const roles = [
      { name: "Newbie", level: 0 },
      { name: "Copper Member", level: 5 },
      { name: "Silver Member", level: 15 },
      { name: "Gold Member", level: 30 },
      { name: "Platinum Pro", level: 50 },
      { name: "Elite Commander", level: 75 },
      { name: "Legendary User", level: 100 },
      { name: "Ancient Being", level: 200 },
      { name: "The Overseer", level: 500 }
    ];

    // Mengambil role tertinggi yang sesuai dengan level user
    return roles.reverse().find(role => level >= role.level) || { name: "Newbie", level: 0 }
  }
}