import { FindAllPlants201Item } from "@/src/http/generated/api.schemas";
import { PlantFormData } from "@/src/pages/add-plants/add-plants-schema";

export function convertPlantToFormData({
  plantData,
}: {
  plantData: FindAllPlants201Item;
}) {
  const formData: PlantFormData = {
    name: plantData.name || "",
    typeId: plantData.typeId || "",
    description: plantData.description || "",
    origin: plantData.origin || "",
    latitude: String(plantData.latitude) || "",
    longitude: String(plantData.longitude) || "",
    observation: plantData.observation || "",
    identificationNumber: plantData.identificationNumber || "",
    plantationDate: plantData.plantationDate
      ? new Date(plantData.plantationDate)
      : undefined,
    pictureDate: plantData.pictureDate
      ? new Date(plantData.pictureDate)
      : undefined,
    lastWatering: plantData.lastWatering
      ? new Date(plantData.lastWatering)
      : undefined,
    lastFertilization: plantData.lastFertilization
      ? new Date(plantData.lastFertilization)
      : undefined,
    lastPestControl: plantData.lastPestControl
      ? new Date(plantData.lastPestControl)
      : undefined,
    lastPruning: plantData.lastPruning
      ? new Date(plantData.lastPruning)
      : undefined,
    lastHarvest: plantData.lastHarvest
      ? new Date(plantData.lastHarvest)
      : undefined,
    lastWeeding: plantData.lastWeeding
      ? new Date(plantData.lastWeeding)
      : undefined,
    lastSoilAnalysis: plantData.lastSoilAnalysis
      ? new Date(plantData.lastSoilAnalysis)
      : undefined,
    image: plantData.image || "",
    centerId: plantData?.center?.id || "",
  };

  return formData;
}


export function convertFormDataToPlant({
  formData,
}: {
  formData: PlantFormData;
}): FindAllPlants201Item {
  const plant: FindAllPlants201Item = {
    id: formData.id || "",
    name: formData.name,
    typeId: formData.typeId,
    description: formData.description || "",
    origin: formData.origin || "",
    latitude: +formData.latitude,
    longitude: +formData.longitude,
    observation: formData.observation || "",
    identificationNumber: formData.identificationNumber || "",
    plantationDate: formData.plantationDate?.toISOString() || "",
    pictureDate: formData.pictureDate?.toISOString() || "",
    lastWatering: formData.lastWatering?.toISOString() || "",
    lastFertilization: formData.lastFertilization?.toISOString() || "",
    lastPestControl: formData.lastPestControl?.toISOString() || "",
    lastPruning: formData.lastPruning?.toISOString() || "",
    lastHarvest: formData.lastHarvest?.toISOString() || "",
    lastWeeding: formData.lastWeeding?.toISOString() || "",
    lastSoilAnalysis: formData.lastSoilAnalysis?.toISOString() || "",
    image: formData.image || "",
    isIdentified: false,
    address: formData.address || "",
    type: {
      id: formData.typeId,
      name: "", // This should be filled with the actual type name if available
    },
    center: {
      id: formData.centerId,
      name: "", // This should be filled with the actual center name if available
      region: "", // This should be filled with the actual region if available
    },
    createdAt: new Date().toISOString(), // Assuming current date for creation
    updatedAt: new Date().toISOString(), // Assuming current date for update
    deletedAt: null, // Assuming no deletion date
  };

  return plant;
}