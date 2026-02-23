// Conditional rules - defines when items should be included/excluded
export const conditionalRules = {
    weather: {
        cold: {
            trigger: (weather) => weather.some(day => day.temp < 10),
            items: {
                'Warm jacket': { multiplier: 0, essential: true },
                'Thermal layers': { multiplier: 0.4, essential: true },
                'Warm hat': { multiplier: 0, essential: true },
                'Gloves': { multiplier: 0.2, essential: true },
                'Scarf': { multiplier: 0, essential: false },
                'Warm socks': { multiplier: 0.6, essential: true }
            }
        },
        hot: {
            trigger: (weather) => weather.some(day => day.temp > 25),
            items: {
                'Light breathable shirts': { 
                    multiplier: 0.8, 
                    essential: true,
                    description: 'Lightweight and breathable'
                },
                'Shorts': { multiplier: 0.4, essential: true },
                'Sun hat': { multiplier: 0, essential: true },
                'Sunglasses': { multiplier: 0, essential: true },
                'Extra sunscreen': { multiplier: 0, essential: true },
                'Sandals': { multiplier: 0, essential: false }
            }
        },
        rainy: {
            trigger: (weather) => weather.some(day => 
                day.condition.toLowerCase().includes('rain') || day.chanceOfRain > 40
            ),
            items: {
                'Waterproof jacket': { multiplier: 0, essential: true },
                'Compact umbrella': { multiplier: 0, essential: true },
                'Waterproof shoes': { multiplier: 0, essential: false },
                'Rain cover for bag': { multiplier: 0, essential: false }
            }
        },
        variable: {
            trigger: (weather) => {
                const temps = weather.map(d => d.temp);
                const range = Math.max(...temps) - Math.min(...temps);
                return range > 10;
            },
            items: {
                'Layering pieces': { 
                    multiplier: 0.4, 
                    essential: true,
                    description: 'For temperature changes'
                },
                'Light jacket': { multiplier: 0, essential: true },
                'Versatile pants': { multiplier: 0.3, essential: true }
            }
        }
    },
    
    // NEW: Transportation-based conditional items
    transportation: {
        plane: {
            trigger: (transportType) => transportType === 'plane',
            categories: ['flight_essentials', 'carry_on_compliance', 'flight_comfort'],
            items: {
                flight_essentials: {
                    'Boarding pass': { multiplier: 0, essential: true },
                    'Passport/ID easily accessible': { multiplier: 0, essential: true },
                    'Phone with boarding pass': { multiplier: 0, essential: true }
                },
                carry_on_compliance: {
                    'TSA-compliant toiletries': { multiplier: 0, essential: true },
                    'Clear quart bag for liquids': { multiplier: 0, essential: true },
                    'Laptop in easy-access bag': { multiplier: 0, essential: true },
                    'No prohibited items': { multiplier: 0, essential: true }
                },
                flight_comfort: {
                    'Neck pillow': { multiplier: 0, essential: false },
                    'Eye mask': { multiplier: 0, essential: false },
                    'Earplugs/noise-canceling headphones': { multiplier: 0, essential: false },
                    'Compression socks': { multiplier: 0, essential: false },
                    'Hydration (empty bottle)': { multiplier: 0, essential: true },
                    'Entertainment device': { multiplier: 0, essential: false }
                }
            }
        },
        international_flight: {
            trigger: (transportType, tripData) => 
                transportType === 'plane' && conditionalRules.isInternationalTrip(tripData),
            items: {
                'Passport with 6+ months validity': { multiplier: 0, essential: true },
                'Visa documents': { multiplier: 0, essential: true },
                'Travel insurance documents': { multiplier: 0, essential: true },
                'Emergency contact info': { multiplier: 0, essential: true },
                'Currency converter app': { multiplier: 0, essential: false },
                'Universal power adapter': { multiplier: 0, essential: true },
                'Jet lag remedies': { multiplier: 0, essential: false }
            }
        },
        long_haul_flight: {
            trigger: (transportType, tripData) => 
                transportType === 'plane' && tripData.flightDuration > 6,
            items: {
                'Extra entertainment': { multiplier: 0, essential: true },
                'Comfortable clothing layers': { multiplier: 0, essential: true },
                'Skincare for dry air': { multiplier: 0, essential: false },
                'Compression socks': { multiplier: 0, essential: true },
                'Melatonin for sleep': { multiplier: 0, essential: false },
                'Healthy snacks': { multiplier: 0, essential: false }
            }
        },
car: {
  trigger: (transportType) => transportType === 'car',
  items: {
    car_documents: {
      'Valid driver\'s license': { multiplier: 0, essential: true },
      'Car registration': { multiplier: 0, essential: true },
      'Insurance card': { multiplier: 0, essential: true }
    },
    car_emergency: {
      'Emergency roadside kit': { multiplier: 0, essential: true },
      'Phone car charger': { multiplier: 0, essential: true },
      'Cash for tolls': { multiplier: 0, essential: true },
      'Paper maps backup': { multiplier: 0, essential: false },
      'First aid kit': { multiplier: 0, essential: true },
      'Road trip snacks': { multiplier: 0.3, essential: false }
    }
  }
},
        ferry: {
            trigger: (transportType) => transportType === 'ferry',
            items: {
                'Motion sickness medication': { multiplier: 0, essential: false },
                'Waterproof bag for electronics': { multiplier: 0, essential: true },
                'Warm jacket for deck': { multiplier: 0, essential: true },
                'Entertainment for long crossings': { multiplier: 0, essential: false },
                'Comfortable shoes with grip': { multiplier: 0, essential: true }
            }
        }
    },

    // NEW: Accommodation-based conditional items
    accommodation: {
        hotel: {
            trigger: (accommodationType) => accommodationType === 'hotel',
            items: {
                'Personal toiletries only': { 
                    multiplier: 0, 
                    essential: true,
                    description: 'Hotel provides basics'
                },
                'Tip money for housekeeping': { multiplier: 0, essential: false },
                'Hotel confirmation': { multiplier: 0, essential: true },
                'Loyalty program info': { multiplier: 0, essential: false }
            }
        },
        luxury_hotel: {
            trigger: (accommodationType, tripData) => 
                accommodationType === 'hotel' && tripData.luxuryLevel === 'high',
            items: {
                'Formal dinner attire': { multiplier: 0, essential: true },
                'Dress shoes': { multiplier: 0, essential: true },
                'Upscale casual wear': { multiplier: 0.3, essential: true }
            }
        },
        airbnb: {
            trigger: (accommodationType) => accommodationType === 'airbnb',
            items: {
                'All personal toiletries': { multiplier: 0, essential: true },
                'Basic cooking supplies': { multiplier: 0, essential: false },
                'Cleaning supplies': { multiplier: 0, essential: true },
                'Laundry detergent': { multiplier: 0, essential: false },
                'Coffee/tea': { multiplier: 0, essential: false },
                'Breakfast basics': { multiplier: 0, essential: false },
                'Check-in instructions': { multiplier: 0, essential: true },
                'Host contact info': { multiplier: 0, essential: true }
            }
        },
        hostel: {
            trigger: (accommodationType) => accommodationType === 'hostel',
            items: {
                'Padlock for lockers': { multiplier: 0, essential: true },
                'Quick-dry towel': { multiplier: 0, essential: true },
                'Flip flops for showers': { multiplier: 0, essential: true },
                'Earplugs': { multiplier: 0, essential: true },
                'Eye mask': { multiplier: 0, essential: true },
                'Money belt/security wallet': { multiplier: 0, essential: true },
                'Toiletry caddy': { multiplier: 0, essential: true }
            }
        },
        camping: {
            trigger: (accommodationType) => accommodationType === 'camping',
            items: {
                'Complete camping setup': { multiplier: 0, essential: true },
                'All food and water': { multiplier: 0, essential: true },
                'Camping stove and fuel': { multiplier: 0, essential: true },
                'Biodegradable soap': { multiplier: 0, essential: true },
                'Insect repellent': { multiplier: 0, essential: true },
                'Headlamp and backup batteries': { multiplier: 0, essential: true },
                'Weather protection': { multiplier: 0, essential: true }
            }
        },
        family_friends: {
            trigger: (accommodationType) => accommodationType === 'family',
            items: {
                'Host gift': { multiplier: 0, essential: true },
                'Contribution to meals': { multiplier: 0, essential: true },
                'Personal toiletries': { multiplier: 0, essential: true },
                'Thank you card': { multiplier: 0, essential: true },
                'Respectful house clothes': { multiplier: 0, essential: true },
                'Personal towel (optional)': { multiplier: 0, essential: false }
            }
        }
    },

    // NEW: Combination rules (transportation + accommodation)
    combinations: {
        flight_hotel: {
            trigger: (transportType, accommodationType) => 
                transportType === 'plane' && accommodationType === 'hotel',
            items: {
                'Hotel shuttle info': { multiplier: 0, essential: false },
                'Airport transfer plan': { multiplier: 0, essential: true },
                'Luggage tags': { multiplier: 0, essential: true }
            }
        },
        flight_international_hotel: {
            trigger: (transportType, accommodationType, tripData) => 
                transportType === 'plane' && accommodationType === 'hotel' && 
                conditionalRules.isInternationalTrip(tripData),
            items: {
                'Currency for taxi/tips': { multiplier: 0, essential: true },
                'Hotel address in local language': { multiplier: 0, essential: true },
                'Customs declaration forms': { multiplier: 0, essential: true }
            }
        },
        car_camping: {
            trigger: (transportType, accommodationType) => 
                transportType === 'car' && accommodationType === 'camping',
            items: {
                'Car camping gear': { multiplier: 0, essential: true },
                'Cooler for car transport': { multiplier: 0, essential: true },
                'Extra fuel containers': { multiplier: 0, essential: false },
                'Emergency car supplies': { multiplier: 0, essential: true }
            }
        }
    },

    // Updated temperature clothing (existing code)
    temperatureClothing: {
        freezing: {
            trigger: (avgTemp) => avgTemp < 0,
            items: {
                'Heavy winter coat': { multiplier: 0, essential: true },
                'Thermal underwear': { multiplier: 0.6, essential: true },
                'Heavy sweaters': { multiplier: 0.4, essential: true },
                'Insulated boots': { multiplier: 0, essential: true }
            }
        },
        cold: {
            trigger: (avgTemp) => avgTemp >= 0 && avgTemp < 10,
            items: {
                'Medium weight jacket': { multiplier: 0, essential: true },
                'Sweaters': { multiplier: 0.4, essential: true },
                'Long pants': { multiplier: 0.6, essential: true },
                'Closed shoes': { multiplier: 0.2, essential: true }
            }
        },
        mild: {
            trigger: (avgTemp) => avgTemp >= 10 && avgTemp <= 20,
            items: {
                'Light jacket': { multiplier: 0, essential: false },
                'Long sleeve shirts': { multiplier: 0.5, essential: true },
                'Pants and shorts mix': { multiplier: 0.4, essential: true }
            }
        },
        warm: {
            trigger: (avgTemp) => avgTemp > 20 && avgTemp <= 30,
            items: {
                'Light shirts': { multiplier: 0.8, essential: true },
                'Shorts': { multiplier: 0.6, essential: true },
                'Light pants': { multiplier: 0.3, essential: false },
                'Breathable shoes': { multiplier: 0, essential: true }
            }
        },
        hot: {
            trigger: (avgTemp) => avgTemp > 30,
            items: {
                'Ultra-light clothing': { multiplier: 1, essential: true },
                'Shorts only': { multiplier: 0.8, essential: true },
                'Sandals': { multiplier: 0, essential: true },
                'Cooling accessories': { multiplier: 0, essential: false }
            }
        }
    },
    
    activities: {
        business: {
            category: 'business_items',
            items: {
                'Business attire': { multiplier: 0.4, essential: true, min: 2 },
                'Dress shoes': { multiplier: 0, essential: true },
                'Laptop & accessories': { multiplier: 0, essential: true },
                'Business cards': { multiplier: 0, essential: true },
                'Professional bag': { multiplier: 0, essential: true }
            }
        },
        sightseeing: {
            category: 'activity_items',
            items: {
                'Comfortable walking shoes': { multiplier: 0.2, essential: true },
                'Day backpack': { multiplier: 0, essential: true },
                'Guidebook/maps': { multiplier: 0, essential: false },
                'Portable charger': { multiplier: 0, essential: true },
                'Camera': { multiplier: 0, essential: false }
            }
        },
        hiking: {
            category: 'hiking_gear',
            items: {
                'Hiking boots': { multiplier: 0, essential: true },
                'Hiking backpack': { multiplier: 0, essential: true },
                'Quick-dry clothing': { multiplier: 0.6, essential: true },
                'First aid kit': { multiplier: 0, essential: true },
                'Trail maps/GPS': { multiplier: 0, essential: true },
                'Water bottles': { multiplier: 0.2, essential: true }
            }
        },
        beach: {
            category: 'beach_gear',
            items: {
                'Swimwear': { multiplier: 0.4, essential: true, min: 2 },
                'Beach towel': { multiplier: 0, essential: true },
                'Flip flops': { multiplier: 0, essential: true },
                'Beach bag': { multiplier: 0, essential: false },
                'Waterproof phone case': { multiplier: 0, essential: false }
            }
        },
        photography: {
            category: 'photography_gear',
            items: {
                'Camera equipment': { multiplier: 0, essential: true },
                'Extra batteries': { multiplier: 0.3, essential: true },
                'Memory cards': { multiplier: 0.3, essential: true },
                'Lens cleaning kit': { multiplier: 0, essential: true },
                'Camera bag': { multiplier: 0, essential: true }
            }
        },
        workout: {
            category: 'fitness_gear',
            items: {
                'Workout clothes': { multiplier: 0.4, essential: true },
                'Athletic shoes': { multiplier: 0, essential: true },
                'Sports accessories': { multiplier: 0, essential: false },
                'Gym towel': { multiplier: 0.2, essential: false }
            }
        },
            watersports: {
        category: 'water_sports_gear',
        items: {
            'Waterproof phone case': { multiplier: 0, essential: true },
            'Quick-dry towel': { multiplier: 0, essential: true },
            'Water shoes': { multiplier: 0, essential: true },
            'Dry bag': { multiplier: 0, essential: true },
            'Waterproof sunscreen': { multiplier: 0, essential: true }
        }
    },
    entertainment: {
        category: 'entertainment_gear',
        items: {
            'Evening attire': { multiplier: 0.3, essential: true },
            'Dress shoes': { multiplier: 0, essential: true },
            'Small evening bag': { multiplier: 0, essential: false },
            'Cash for venues': { multiplier: 0, essential: true }
        }
    },
    shopping: {
        category: 'shopping_gear',
        items: {
            'Extra luggage/duffle bag': { multiplier: 0, essential: true },
            'Reusable shopping bags': { multiplier: 0.2, essential: true },
            'Comfortable walking shoes': { multiplier: 0, essential: true },
            'Luggage scale': { multiplier: 0, essential: false }
        }
    },
    family: {
        category: 'family_travel_gear',
        items: {
            'Kid entertainment': { multiplier: 0.5, essential: true },
            'Extra snacks': { multiplier: 1, essential: true },
            'Wipes': { multiplier: 1, essential: true },
            'First aid kit': { multiplier: 0, essential: true }
        }
    },
    relaxation: {
        category: 'relaxation_gear',
        items: {
            'Books/e-reader': { multiplier: 0.2, essential: true },
            'Journal': { multiplier: 0, essential: false },
            'Comfortable loungewear': { multiplier: 0.4, essential: true },
            'Eye mask': { multiplier: 0, essential: false }
        }
    }
},
    
    tripTypes: {
        business: {
            items: {
                business_items: {
                    'Professional wardrobe': { multiplier: 0.5, essential: true },
                    'Work electronics': { multiplier: 0, essential: true },
                    'Office supplies': { multiplier: 0, essential: true }
                }
            }
        },
        camping: {
            items: {
                camping_gear: {
                    'Tent': { multiplier: 0, essential: true },
                    'Sleeping bag': { multiplier: 0, essential: true },
                    'Camping stove': { multiplier: 0, essential: true },
                    'Camping utensils': { multiplier: 0, essential: true },
                    'Headlamp': { multiplier: 0, essential: true }
                }
            }
        },
        'winter-sports': {
            items: {
                winter_sports_gear: {
                    'Ski/snowboard wear': { multiplier: 0, essential: true },
                    'Thermal layers': { multiplier: 0.8, essential: true },
                    'Winter sports accessories': { multiplier: 0, essential: true }
                }
            }
        }
    },
    
    duration: {
        weekend: {
            trigger: (nights) => nights <= 3,
            items: {
                'Travel-size toiletries': { multiplier: 0, essential: true },
                'Minimal clothing': { multiplier: 0, essential: false }
            }
        },
        week: {
            trigger: (nights) => nights > 3 && nights <= 7,
            items: {
                'Laundry detergent pods': { multiplier: 0, essential: false },
                'Extra toiletries': { multiplier: 0, essential: false }
            }
        },
        extended: {
            trigger: (nights) => nights > 7,
            items: {
                'Laundry supplies': { multiplier: 0, essential: true },
                'Extra toiletries': { multiplier: 0, essential: true },
                'Backup chargers': { multiplier: 0, essential: true },
                'Sewing kit': { multiplier: 0, essential: false }
            }
        }
    },
    
    replacements: [
        {
            replacingItems: ['Light shirts', 'Shorts'],
            replacedItems: ['Heavy sweaters', 'Thermal underwear', 'Winter clothing']
        },
        {
            replacingItems: ['Warm jacket', 'Thermal layers'],
            replacedItems: ['Tank tops', 'Light summer clothes']
        },
        {
            replacingItems: ['Business attire'],
            replacedItems: ['Casual-only clothing']
        },
        {
            replacingItems: ['Hiking boots'],
            replacedItems: ['Dress shoes only']
        },
        // NEW: Transportation-specific replacements
        {
            replacingItems: ['TSA-compliant toiletries'],
            replacedItems: ['Large toiletry bottles', 'Prohibited items']
        },
        {
            replacingItems: ['Hotel confirmation'],
            replacedItems: ['Camping gear', 'Cooking supplies']
        },
        {
            replacingItems: ['Padlock for lockers'],
            replacedItems: ['Expensive jewelry', 'Valuable electronics']
        }
    ],

    // Helper functions for complex logic
    isInternationalTrip: (tripData) => {
        if (!tripData.location) return false;
        
        const location = tripData.location.toLowerCase();
        const notes = (tripData.notes || '').toLowerCase();
        
        // Enhanced detection logic
        return (
            location.includes(',') || 
            notes.includes('international') ||
            notes.includes('passport') ||
            notes.includes('visa') ||
            location.includes('europe') ||
            location.includes('asia') ||
            location.includes('uk') ||
            location.includes('canada') ||
            location.includes('mexico') ||
            // Add more country/region detection as needed
            /\b(france|spain|italy|germany|japan|china|india|brazil)\b/.test(location)
        );
    },

    // NEW: Priority system for conflicting rules
    rulePriority: {
        transportation: 10,  // Highest priority
        accommodation: 9,
        weather: 8,
        activities: 7,
        tripTypes: 6,
        duration: 5,
        temperatureClothing: 4  // Lowest priority
    }
};