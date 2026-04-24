/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export const AFRICAN_DIRECTORY: Record<string, string[]> = {
  "Nigeria": ["Lagos", "Abuja", "Port Harcourt", "Ibadan", "Kano", "Abeokuta", "Enugu", "Benin City", "Jos", "Kaduna", "Uyo", "Calabar", "Warri"],
  "Ghana": ["Accra", "Kumasi", "Tema", "Tamale", "Sekondi-Takoradi", "Cape Coast", "Sunyani"],
  "Kenya": ["Nairobi", "Mombasa", "Kisumu", "Nakuru", "Eldoret", "Malindi"],
  "South Africa": ["Johannesburg", "Cape Town", "Durban", "Pretoria", "Port Elizabeth", "Bloemfontein", "East London"],
  "Rwanda": ["Kigali", "Gisenyi", "Butare", "Musanze"],
  "Ethiopia": ["Addis Ababa", "Dire Dawa", "Adama", "Gondar", "Bahir Dar", "Mek'ele"],
  "Egypt": ["Cairo", "Alexandria", "Giza", "Shubra El Kheima", "Port Said", "Suez"],
  "Morocco": ["Casablanca", "Rabat", "Marrakesh", "Fes", "Tangier", "Agadir"],
  "Senegal": ["Dakar", "Touba", "Thies", "Saint-Louis", "Kaolack"],
  "Tanzania": ["Dar es Salaam", "Mwanza", "Arusha", "Dodoma", "Mbeya", "Morogoro"],
  "Uganda": ["Kampala", "Entebbe", "Mbarara", "Jinja", "Gulu"],
  "Ivory Coast": ["Abidjan", "Bouaké", "Daloa", "Yamoussoukro", "San-Pédro"],
  "Angola": ["Luanda", "Huambo", "Lobito", "Benguela", "Lubango"],
  "Zambia": ["Lusaka", "Kitwe", "Ndola", "Kabwe", "Chingola"],
  "Zimbabwe": ["Harare", "Bulawayo", "Chitungwiza", "Mutare", "Gweru"],
  "Cameroon": ["Douala", "Yaoundé", "Garoua", "Bamenda", "Maroua"],
  "DR Congo": ["Kinshasa", "Lubumbashi", "Mbuji-Mayi", "Kananga", "Kisangani"],
  "Botswana": ["Gaborone", "Francistown", "Molepolole", "Maun"],
  "Namibia": ["Windhoek", "Walvis Bay", "Swakopmund", "Oshakati"],
  "Mozambique": ["Maputo", "Matola", "Beira", "Nampula", "Chimoio"],
  "Gambia": ["Banjul", "Bakau", "Serekunda"],
  "Sierra Leone": ["Freetown", "Bo", "Kenema", "Makeni"],
  "Gabon": ["Libreville", "Port-Gentil", "Franceville"],
  "Mauritius": ["Port Louis", "Beau Bassin", "Vacoas", "Curepipe"]
};

export const AFRICAN_LOCATIONS = Object.entries(AFRICAN_DIRECTORY).flatMap(([country, cities]) => 
  cities.map(city => `${city}, ${country}`)
);

export const INDUSTRIES = [
  "Fintech", "Logistics", "Agrotech", "E-commerce", "Healthtech", "Real Estate",
  "Manufacturing", "Edtech", "Hospitality", "Retail", "Renewable Energy",
  "Telecommunications", "Legal Services", "Construction", "FMCG",
  "Banking", "Insurance", "Mining", "Entertainment", "Professional Services",
  "Automotive", "Food & Beverage", "Pharmaceuticals", "Security", "Fashion",
  "Transport", "Waste Management", "Public Sector", "NGO"
];
