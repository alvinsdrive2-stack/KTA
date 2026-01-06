# Province Integration Plan for KTA System

## Overview
This document outlines the plan to integrate province data into the KTA system for region-based access control.

## Key Understanding
- `Daerah` in KTA system = **Provinsi** (Province)
- The system already has region-based access control using `daerahId`
- Need to map SIKI province data to existing `daerah` table

## Province Data (for mapping)
```json
[
  {"ID_Propinsi":"01","id_propinsi_dagri":"11","Nama":"Aceh"},
  {"ID_Propinsi":"02","id_propensi_dagri":"12","Nama":"Sumatera Utara"},
  {"ID_Propinsi":"03","id_propensi_dagri":"13","Nama":"Sumatera Barat"},
  {"ID_Propinsi":"04","id_propensi_dagri":"14","Nama":"Riau"},
  {"ID_Propinsi":"05","id_propensi_dagri":"15","Nama":"Jambi"},
  {"ID_Propinsi":"06","id_propensi_dagri":"16","Nama":"Sumatera Selatan"},
  {"ID_Propinsi":"07","id_propensi_dagri":"17","Nama":"Bengkulu"},
  {"ID_Propinsi":"08","id_propensi_dagri":"18","Nama":"Lampung"},
  {"ID_Propinsi":"09","id_propensi_dagri":"31","Nama":"DKI Jakarta"},
  {"ID_Propinsi":"10","id_propensi_dagri":"32","Nama":"Jawa Barat"},
  {"ID_Propinsi":"11","id_propensi_dagri":"33","Nama":"Jawa Tengah"},
  {"ID_Propinsi":"12","id_propensi_dagri":"34","Nama":"DI Yogyakarta"},
  {"ID_Propinsi":"13","id_propensi_dagri":"35","Nama":"Jawa Timur"},
  {"ID_Propinsi":"14","id_propensi_dagri":"61","Nama":"Kalimantan Barat"},
  {"ID_Propinsi":"15","id_propensi_dagri":"62","Nama":"Kalimantan Tengah"},
  {"ID_Propinsi":"16","id_propensi_dagri":"63","Nama":"Kalimantan Selatan"},
  {"ID_Propinsi":"17","id_propensi_dagri":"64","Nama":"Kalimantan Timur"},
  {"ID_Propinsi":"18","id_propensi_dagri":"71","Nama":"Sulawesi Utara"},
  {"ID_Propinsi":"19","id_propensi_dagri":"72","Nama":"Sulawesi Tengah"},
  {"ID_Propinsi":"20","id_propensi_dagri":"73","Nama":"Sulawesi Selatan"},
  {"ID_Propinsi":"21","id_propensi_dagri":"74","Nama":"Sulawesi Tenggara"},
  {"ID_Propinsi":"22","id_propensi_dagri":"51","Nama":"Bali"},
  {"ID_Propinsi":"23","id_propensi_dagri":"52","Nama":"Nusa Tenggara Barat"},
  {"ID_Propinsi":"24","id_propensi_dagri":"53","Nama":"Nusa Tenggara Timur"},
  {"ID_Propinsi":"25","id_propensi_dagri":"81","Nama":"Maluku"},
  {"ID_Propinsi":"26","id_propensi_dagri":"91","Nama":"Papua"},
  {"ID_Propinsi":"27","id_propensi_dagri":"82","Nama":"Maluku Utara"},
  {"ID_Propinsi":"28","id_propensi_dagri":"36","Nama":"Banten"},
  {"ID_Propinsi":"29","id_propensi_dagri":"75","Nama":"Gorontalo"},
  {"ID_Propinsi":"30","id_propensi_dagri":"19","Nama":"Kepulauan Bangka Belitung"},
  {"ID_Propinsi":"31","id_propensi_dagri":"21","Nama":"Kepulauan Riau"},
  {"ID_Propinsi":"32","id_propensi_dagri":"92","Nama":"Papua Barat"},
  {"ID_Propinsi":"33","id_propensi_dagri":"76","Nama":"Sulawesi Barat"},
  {"ID_Propinsi":"34","id_propensi_dagri":"65","Nama":"Kalimantan Utara"}
]
```

## Implementation Steps

### 1. Update Daerah Table
- Add `idPropinsiDagri` field to `Daerah` model
- Update existing daerah records with province codes
- Use `namaDaerah` to match with province names

### 2. SIKI API Enhancement
- Update `lib/siki-api.ts` to extract province from address
- Map extracted province to `daerah` table using province names
- Return `daerahId` for KTA request assignment

### 3. Province Mapping Logic
```typescript
// Example mapping function
function mapProvinceToDaerah(provinceName: string): string {
  const provinceMap: { [key: string]: string } = {
    "DKI Jakarta": "DKI Jakarta",
    "Jawa Barat": "Jawa Barat",
    "Jawa Tengah": "Jawa Tengah",
    // ... all provinces
  }

  return provinceMap[provinceName] || findClosestMatch(provinceName)
}
```

### 4. Update KTA Creation Flow
- When fetching from SIKI:
  1. Extract province from address
  2. Find matching `daerah` record
  3. Assign correct `daerahId` to KTA request

## Next Steps
1. Check existing `daerah` table data
2. Update schema with `idPropinsiDagri` field
3. Create province mapping utility
4. Update SIKI integration to auto-assign daerah
5. Test with real SIKI data