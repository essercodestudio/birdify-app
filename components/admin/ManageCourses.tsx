// components/admin/ManageCourses.tsx - VERSÃO FINAL E COMPLETA COM EDIÇÃO DETALHADA

import React, { useState, useEffect } from "react";
import axios from "axios";
import Button from "../Button";
import { User } from "../../types";

interface ManageCoursesProps {
  onCourseCreated: () => void;
  adminUser: User | null;
}

const teeColors = ["Gold", "Blue", "White", "Red"];
const teeColorStyles: { [key: string]: string } = {
  Gold: "bg-yellow-500 text-black",
  Blue: "bg-blue-600 text-white",
  White: "bg-white text-black",
  Red: "bg-red-600 text-white",
};
interface TeeData {
  [key: string]: string;
}
interface HoleData {
  holeNumber: number;
  par: string;
  tees: TeeData;
}

const createInitialHoles = (): HoleData[] => {
  return Array.from({ length: 18 }, (_, i) => ({
    holeNumber: i + 1,
    par: "4",
    tees: { Gold: "", Blue: "", White: "", Red: "" },
  }));
};

const ManageCourses: React.FC<ManageCoursesProps> = ({
  onCourseCreated,
  adminUser,
}) => {
  const [courses, setCourses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newCourseName, setNewCourseName] = useState("");
  const [newCourseLocation, setNewCourseLocation] = useState("");
  const [holesData, setHolesData] = useState<HoleData[]>(createInitialHoles());
  const [holeImages, setHoleImages] = useState<Record<number, File | null>>({});

  // ESTADOS PARA O MODAL DE EDIÇÃO
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingCourse, setEditingCourse] = useState<any | null>(null);

  // ... dentro de ManageCourses.tsx ...

  const fetchCourses = async () => {
    if (!adminUser) return;
    setLoading(true);
    try {
      const response = await axios.get(
        `${import.meta.env.VITE_API_URL}/api/courses`,
        {
          params: { adminId: adminUser.id },
        }
      );
      setCourses(response.data);
    } catch (err: any) {
      // ADICIONE ESTA LINHA PARA VER O ERRO DETALHADO
      console.error("Erro detalhado ao buscar campos:", err.response?.data || err.message);
      setError("Falha ao carregar os campos.");
    } finally {
      setLoading(false);
    }
  };

// ... resto do ficheiro ...

  useEffect(() => {
    if (adminUser) {
      fetchCourses();
    }
  }, [adminUser]);

  const handleHoleDataChange = (
    index: number,
    field: "par" | "tee",
    value: string,
    teeColor?: string
  ) => {
    const newHolesData = [...holesData];
    if (field === "par") {
      newHolesData[index].par = value;
    } else if (field === "tee" && teeColor) {
      newHolesData[index].tees[teeColor] = value;
    }
    setHolesData(newHolesData);
  };

  const handleImageChange = (holeNumber: number, file: File | null) => {
    setHoleImages((prev) => ({ ...prev, [holeNumber]: file }));
  };

  const handleCreateCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminUser) {
      alert("Erro: Utilizador administrador não encontrado.");
      return;
    }
    const formData = new FormData();
    formData.append("name", newCourseName);
    formData.append("location", newCourseLocation);
    formData.append("adminId", adminUser.id.toString());
    const holesPayload = holesData.map((hole) => ({
      ...hole,
      par: parseInt(hole.par, 10),
      tees: Object.fromEntries(
        Object.entries(hole.tees).map(([color, yardage]: [string, string]) => [
          color,
          parseInt(yardage, 10) || 0,
        ])
      ),
    }));
    formData.append("holes", JSON.stringify(holesPayload));
    holesData.forEach((hole) => {
      const file = holeImages[hole.holeNumber];
      if (file) {
        formData.append("holeImages", file, `hole_${hole.holeNumber}`);
      }
    });
    try {
      await axios.post(
        `${import.meta.env.VITE_API_URL}/api/courses`,
        formData,
        {
          headers: { "Content-Type": "multipart/form-data" },
        }
      );
      setNewCourseName("");
      setNewCourseLocation("");
      setHolesData(createInitialHoles());
      setHoleImages({});
      alert("Campo criado com sucesso!");
      onCourseCreated();
      fetchCourses(); // Re-busca os campos para atualizar a lista
    } catch (error) {
      alert("Erro ao criar o campo. Verifique o console.");
      console.error(error);
    }
  };

  const handleDeleteCourse = async (courseId: number) => {
    if (
      window.confirm(
        "Tem a certeza de que quer apagar este campo? Esta ação é irreversível."
      )
    ) {
      try {
        await axios.delete(
          `${import.meta.env.VITE_API_URL}/api/courses/${courseId}`
        );
        fetchCourses();
      } catch (error: any) {
        alert(
          error.response?.data?.error || "Não foi possível apagar o campo."
        );
      }
    }
  };

  // --- FUNÇÕES DE EDIÇÃO DETALHADA ---
  const handleOpenEditModal = async (courseId: number) => {
    try {
      const response = await axios.get(
        `${import.meta.env.VITE_API_URL}/api/courses/${courseId}/details`
      );
      setEditingCourse(response.data);
      setIsEditModalOpen(true);
    } catch (error) {
      alert("Não foi possível carregar os dados do campo para edição.");
    }
  };

  const handleEditingHoleChange = (holeId: number, par: string) => {
    const newHoles = editingCourse.holes.map((h: any) =>
      h.id === holeId ? { ...h, par: parseInt(par, 10) || 3 } : h
    );
    setEditingCourse({ ...editingCourse, holes: newHoles });
  };

  const handleEditingTeeChange = (
    holeId: number,
    teeId: number,
    yardage: string
  ) => {
    const newHoles = editingCourse.holes.map((h: any) => {
      if (h.id === holeId) {
        const newTees = h.tees.map((t: any) =>
          t.id === teeId ? { ...t, yardage: parseInt(yardage, 10) || 0 } : t
        );
        return { ...h, tees: newTees };
      }
      return h;
    });
    setEditingCourse({ ...editingCourse, holes: newHoles });
  };

  const handleUpdateCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCourse) return;
    try {
      await axios.put(
        `${import.meta.env.VITE_API_URL}/api/courses/${
          editingCourse.id
        }/details`,
        {
          name: editingCourse.name,
          location: editingCourse.location,
          holes: editingCourse.holes,
        }
      );
      setIsEditModalOpen(false);
      setEditingCourse(null);
      fetchCourses();
      alert("Campo atualizado com sucesso!");
    } catch (error) {
      alert("Falha ao atualizar o campo.");
    }
  };

  if (loading) return <p>A carregar...</p>;
  if (error) return <div className="text-red-400">{error}</div>;

  return (
    <div className="space-y-8">
      <div className="p-6 bg-gray-700/50 rounded-lg">
        <h3 className="text-xl font-bold text-green-400 mb-4">
          Criar Novo Campo
        </h3>
        <form onSubmit={handleCreateCourse} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input
              type="text"
              value={newCourseName}
              onChange={(e) => setNewCourseName(e.target.value)}
              placeholder="Nome do Campo"
              required
              className="w-full px-3 py-2 border border-gray-600 bg-gray-900 text-white rounded-md"
            />
            <input
              type="text"
              value={newCourseLocation}
              onChange={(e) => setNewCourseLocation(e.target.value)}
              placeholder="Localização"
              required
              className="w-full px-3 py-2 border border-gray-600 bg-gray-900 text-white rounded-md"
            />
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-gray-800">
                <tr>
                  <th className="px-2 py-2 text-center text-xs font-medium text-gray-300 uppercase">
                    Buraco
                  </th>
                  <th className="px-2 py-2 text-center text-xs font-medium text-gray-300 uppercase">
                    Par
                  </th>
                  {teeColors.map((color) => (
                    <th
                      key={color}
                      className="px-2 py-2 text-center text-xs font-medium text-gray-300 uppercase"
                    >
                      <div
                        className={`py-1 px-2 rounded-md ${teeColorStyles[color]} inline-block`}
                      >
                        {color}
                      </div>
                    </th>
                  ))}
                  <th className="px-2 py-2 text-center text-xs font-medium text-gray-300 uppercase">
                    Foto Aérea
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {holesData.map((hole, index) => (
                  <tr key={hole.holeNumber} className="text-center">
                    <td className="px-2 py-2 font-bold text-white">
                      {hole.holeNumber}
                    </td>
                    <td className="px-2 py-2">
                      <input
                        type="number"
                        min="3"
                        max="5"
                        value={hole.par}
                        onChange={(e) =>
                          handleHoleDataChange(index, "par", e.target.value)
                        }
                        required
                        className="w-16 text-center p-1 border border-gray-600 bg-gray-900 text-white rounded-md mx-auto"
                      />
                    </td>
                    {teeColors.map((color) => (
                      <td key={color} className="px-2 py-2">
                        <input
                          type="number"
                          value={hole.tees[color]}
                          onChange={(e) =>
                            handleHoleDataChange(
                              index,
                              "tee",
                              e.target.value,
                              color
                            )
                          }
                          className="w-20 text-center p-1 border border-gray-600 bg-gray-900 text-white rounded-md mx-auto"
                        />
                      </td>
                    ))}
                    <td className="px-2 py-2">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) =>
                          handleImageChange(
                            hole.holeNumber,
                            e.target.files ? e.target.files[0] : null
                          )
                        }
                        className="w-full max-w-[200px] text-sm text-gray-400 file:mr-2 file:py-1 file:px-2 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-gray-600 file:text-white hover:file:bg-gray-500"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Button type="submit" className="w-full">
            Salvar Campo Completo
          </Button>
        </form>
      </div>
      <div className="p-6 bg-gray-700/50 rounded-lg">
        <h3 className="text-xl font-bold text-green-400 mb-4">
          Campos Existentes
        </h3>
        <table className="min-w-full divide-y divide-gray-600">
          <thead className="bg-gray-700">
            <tr>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-300 uppercase">
                Nome
              </th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-300 uppercase">
                Ações
              </th>
            </tr>
          </thead>
          <tbody className="bg-gray-800 divide-y divide-gray-600">
            {courses.map((course) => (
              <tr key={course.id}>
                <td className="px-4 py-3">{course.name}</td>
                <td className="px-4 py-3 space-x-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => handleOpenEditModal(course.id)}
                  >
                    Editar Detalhes
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => handleDeleteCourse(course.id)}
                  >
                    Apagar
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {isEditModalOpen && editingCourse && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <form
            onSubmit={handleUpdateCourse}
            className="bg-gray-800 p-6 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col"
          >
            <h3 className="text-2xl font-bold text-white mb-4">
              Editar Campo: {editingCourse.name}
            </h3>
            <div className="flex-grow overflow-y-auto pr-4 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-400">
                    Nome do Campo
                  </label>
                  <input
                    type="text"
                    value={editingCourse.name}
                    onChange={(e) =>
                      setEditingCourse({
                        ...editingCourse,
                        name: e.target.value,
                      })
                    }
                    required
                    className="mt-1 w-full px-3 py-2 border border-gray-600 bg-gray-900 text-white rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400">
                    Localização
                  </label>
                  <input
                    type="text"
                    value={editingCourse.location}
                    onChange={(e) =>
                      setEditingCourse({
                        ...editingCourse,
                        location: e.target.value,
                      })
                    }
                    required
                    className="mt-1 w-full px-3 py-2 border border-gray-600 bg-gray-900 text-white rounded-md"
                  />
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead className="bg-gray-700">
                    <tr>
                      <th className="p-2 text-center text-xs font-medium text-gray-300 uppercase">
                        Buraco
                      </th>
                      <th className="p-2 text-center text-xs font-medium text-gray-300 uppercase">
                        Par
                      </th>
                      {editingCourse.holes[0]?.tees
                        .sort((a: any, b: any) => a.id - b.id)
                        .map((t: any) => (
                          <th
                            key={t.id}
                            className="p-2 text-center text-xs font-medium text-gray-300 uppercase"
                          >
                            {t.color} (jardas)
                          </th>
                        ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-600">
                    {editingCourse.holes.map((hole: any) => (
                      <tr key={hole.id} className="text-center">
                        <td className="p-2 font-bold">{hole.holeNumber}</td>
                        <td className="p-2">
                          <input
                            type="number"
                            value={hole.par}
                            onChange={(e) =>
                              handleEditingHoleChange(hole.id, e.target.value)
                            }
                            className="w-16 text-center p-1 border border-gray-600 bg-gray-900 text-white rounded-md"
                          />
                        </td>
                        {hole.tees
                          .sort((a: any, b: any) => a.id - b.id)
                          .map((tee: any) => (
                            <td key={tee.id} className="p-2">
                              <input
                                type="number"
                                value={tee.yardage}
                                onChange={(e) =>
                                  handleEditingTeeChange(
                                    hole.id,
                                    tee.id,
                                    e.target.value
                                  )
                                }
                                className="w-20 text-center p-1 border border-gray-600 bg-gray-900 text-white rounded-md"
                              />
                            </td>
                          ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="flex justify-end gap-4 pt-4 mt-4 border-t border-gray-700">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setIsEditModalOpen(false)}
              >
                Cancelar
              </Button>
              <Button type="submit">Salvar Alterações</Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default ManageCourses;
