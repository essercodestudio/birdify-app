import React, { useState, useMemo, useEffect } from 'react';
import axios from 'axios';
import Button from '../Button.jsx';

const teeColorOptions = ['Azul', 'Branco', 'Vermelho', 'Dourado'];

const ManageCourses = ({ holes, tees, onCreateCourse, onCreateTeeForHole }) => {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [newCourseName, setNewCourseName] = useState('');
  const [newCourseLocation, setNewCourseLocation] = useState('');
  const [newCourseImage, setNewCourseImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [newCoursePars, setNewCoursePars] = useState(Array(18).fill(4));
  const [selectedCourseId, setSelectedCourseId] = useState(null);
  const [newTeeForms, setNewTeeForms] = useState({});

  useEffect(() => {
    const fetchCourses = async () => {
      try {
        const response = await axios.get('http://localhost:3001/api/courses');
        setCourses(response.data);
        setError(null);
      } catch (err) {
        setError('Falha ao carregar os campos. Verifique se o servidor backend está a correr.');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchCourses();
  }, []);

  const handleImageChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setNewCourseImage(file);
      setImagePreview(URL.createObjectURL(file));
    } else {
      setNewCourseImage(null);
      setImagePreview(null);
    }
  };

  const handleParChange = (index, value) => {
    const newPars = [...newCoursePars];
    const par = parseInt(value, 10);
    newPars[index] = isNaN(par) ? 0 : par;
    setNewCoursePars(newPars);
  };
  
  const handleCreateCourse = (e) => {
    e.preventDefault();
    if (newCourseName.trim() && newCourseLocation.trim() && newCoursePars.every(p => p >= 3 && p <= 5)) {
      const holesData = newCoursePars.map(par => ({ par }));
      onCreateCourse({ name: newCourseName, location: newCourseLocation }, newCourseImage, holesData);
      setNewCourseName('');
      setNewCourseLocation('');
      setNewCourseImage(null);
      setImagePreview(null);
      setNewCoursePars(Array(18).fill(4));
    } else {
        alert("Por favor, preencha todos os campos e certifique-se que o par de todos os buracos está entre 3 e 5.");
    }
  };
  
  const handleNewTeeFormChange = (holeId, field, value) => {
    setNewTeeForms(prev => ({
      ...prev,
      [holeId]: {
        ...prev[holeId] || { color: 'Branco', yardage: '' },
        [field]: value
      }
    }));
  };

  const handleAddTee = (holeId) => {
    const formData = newTeeForms[holeId];
    if (formData && formData.yardage) {
        const yardage = parseInt(formData.yardage, 10);
        if (!isNaN(yardage) && yardage > 0) {
            onCreateTeeForHole(holeId, { color: formData.color, yardage });
            setNewTeeForms(prev => ({ ...prev, [holeId]: { color: 'Branco', yardage: '' } }));
        } else {
            alert('Por favor, insira um valor de jardas válido.');
        }
    }
  };

  const selectedCourse = useMemo(() => {
    return courses.find(c => c.id.toString() === selectedCourseId);
  }, [courses, selectedCourseId]);

  const selectedCourseHoles = useMemo(() => {
    return holes
      .filter(h => h.courseId === selectedCourseId)
      .sort((a, b) => a.holeNumber - b.holeNumber);
  }, [holes, selectedCourseId]);
  
  const getTeesForHole = (holeId) => {
      return tees.filter(t => t.holeId === holeId).sort((a,b) => b.yardage - a.yardage);
  }

  if (loading) {
    return <div className="text-center p-6">A carregar campos do banco de dados...</div>;
  }

  if (error) {
    return <div className="text-center p-6 text-red-400 bg-red-900/50 rounded-lg">{error}</div>;
  }

  return (
    <div className="space-y-8">
      {/* Create Course Section */}
      <div className="p-6 bg-gray-700/50 rounded-lg">
        <h3 className="text-xl font-bold text-green-400 mb-4">Criar Novo Campo</h3>
        <form onSubmit={handleCreateCourse} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input type="text" value={newCourseName} onChange={(e) => setNewCourseName(e.target.value)} placeholder="Nome do Campo" required className="w-full px-3 py-2 border border-gray-600 bg-gray-900 text-white rounded-md"/>
            <input type="text" value={newCourseLocation} onChange={(e) => setNewCourseLocation(e.target.value)} placeholder="Localização" required className="w-full px-3 py-2 border border-gray-600 bg-gray-900 text-white rounded-md"/>
          </div>
           <div>
              <label htmlFor="courseImage" className="block text-sm font-medium text-gray-300 mb-1">Imagem Aérea do Campo (Opcional)</label>
              <input id="courseImage" type="file" accept="image/*" onChange={handleImageChange} className="w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-green-600 file:text-white hover:file:bg-green-700"/>
              {imagePreview && <img src={imagePreview} alt="Prévia" className="mt-2 rounded-lg max-h-40 w-auto"/>}
           </div>
            <div className="pt-4 border-t border-gray-600">
                <h4 className="text-lg font-semibold text-gray-200">Pares dos Buracos</h4>
                <p className="text-sm text-gray-400 mb-2">Defina o par para cada um dos 18 buracos do novo campo.</p>
                <div className="grid grid-cols-3 sm:grid-cols-6 md:grid-cols-9 gap-3">
                    {newCoursePars.map((par, index) => (
                        <div key={index} className="text-center">
                            <label className="text-xs text-gray-400 font-bold">B. {index + 1}</label>
                            <input
                                type="number"
                                min="3"
                                max="5"
                                value={par === 0 ? '' : par}
                                onChange={(e) => handleParChange(index, e.target.value)}
                                required
                                className="w-full text-center p-2 border border-gray-600 bg-gray-800 text-white rounded-md focus:outline-none focus:ring-green-500 focus:border-green-500"
                            />
                        </div>
                    ))}
                </div>
            </div>
          <Button type="submit">Salvar Campo</Button>
        </form>
      </div>

      {/* List Existing Courses Section */}
      <div className="p-6 bg-gray-700/50 rounded-lg">
        <h3 className="text-xl font-bold text-green-400 mb-4">Editar Campo Existente</h3>
        <select value={selectedCourseId ?? ''} onChange={(e) => setSelectedCourseId(e.target.value || null)} className="w-full sm:w-1/2 px-3 py-2 border border-gray-600 bg-gray-900 text-white rounded-md">
          <option value="">-- Selecione um campo para editar os buracos e tees --</option>
          {courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>

        {selectedCourse && (
          <div className="mt-6 space-y-4">
            <div className="flex flex-col sm:flex-row gap-4 items-start">
              {selectedCourse.aerialImageUrl && <img src={selectedCourse.aerialImageUrl} alt={`Vista aérea de ${selectedCourse.name}`} className="rounded-lg w-full sm:w-1/3 object-cover" />}
              <div className="flex-grow">
                 <h4 className="font-semibold text-2xl mb-2 text-white">{selectedCourse.name}</h4>
                 <p className="text-gray-400">{selectedCourse.location}</p>
              </div>
            </div>
            
            <h5 className="text-lg font-bold text-gray-200 pt-4 border-t border-gray-600">Buracos e Tees</h5>
            <div className="space-y-4">
              {selectedCourseHoles.map(hole => (
                <div key={hole.id} className="p-4 bg-gray-800 rounded-lg">
                  <p className="font-bold text-white">Buraco {hole.holeNumber} (Par {hole.par}, SI {hole.strokeIndex})</p>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                    {/* List Existing Tees */}
                    <div>
                        <p className="text-sm font-semibold text-gray-300 mb-1">Tees Cadastrados:</p>
                        {getTeesForHole(hole.id).length > 0 ? (
                            <ul className="text-sm space-y-1">
                                {getTeesForHole(hole.id).map(tee => (
                                    <li key={tee.id} className="flex justify-between bg-gray-900 px-2 py-1 rounded-md">
                                        <span><span className="font-bold" style={{color: tee.color.toLowerCase()}}>{tee.color}</span> Tee</span>
                                        <span className="text-gray-400">{tee.yardage} jardas</span>
                                    </li>
                                ))}
                            </ul>
                        ) : <p className="text-xs text-gray-500 italic">Nenhum tee cadastrado.</p>}
                    </div>
                    {/* Add New Tee Form */}
                    <div className="bg-gray-700/50 p-3 rounded-md">
                        <p className="text-sm font-semibold text-gray-300 mb-2">Adicionar Novo Tee:</p>
                        <div className="flex gap-2 items-end">
                            <div className="flex-1">
                                <label className="text-xs text-gray-400">Cor</label>
                                <select value={newTeeForms[hole.id]?.color || 'Branco'} onChange={e => handleNewTeeFormChange(hole.id, 'color', e.target.value)} className="w-full px-2 py-1.5 border border-gray-600 bg-gray-800 text-white rounded-md text-sm">
                                    {teeColorOptions.map(color => <option key={color} value={color}>{color}</option>)}
                                </select>
                            </div>
                             <div className="flex-1">
                                <label className="text-xs text-gray-400">Jardas</label>
                                <input type="number" min="1" placeholder="Jardas" value={newTeeForms[hole.id]?.yardage || ''} onChange={e => handleNewTeeFormChange(hole.id, 'yardage', e.target.value)} className="w-full px-2 py-1.5 border border-gray-600 bg-gray-800 text-white rounded-md text-sm"/>
                            </div>
                            <Button size="sm" type="button" onClick={() => handleAddTee(hole.id)}>+</Button>
                        </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ManageCourses;