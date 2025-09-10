// backend/src.server.ts - VERSÃO COMPLETA E FINAL COM TODAS AS FUNCIONALIDADES

import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import mysql from 'mysql2/promise';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import ExcelJS from 'exceljs';

dotenv.config();
const app = express();
const port = 3001;
app.use(cors());
app.use(express.json());

const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}
app.use('/uploads', express.static(uploadsDir));

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, 'uploads/'),
    filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`)
});
const upload = multer({ storage: storage });

const dbConfig = {
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  connectionLimit: 10,
};

// --- ROTAS PARA CAMPOS (COURSES) ---
app.get('/api/courses', async (req: Request, res: Response) => {
    try {
        const connection = await mysql.createConnection(dbConfig);
        const [rows] = await connection.execute('SELECT * FROM courses');
        await connection.end();
        res.json(rows);
    } catch (error) {
        console.error('Erro ao buscar campos:', error);
        res.status(500).json({ error: 'Erro ao buscar campos' });
    }
});
app.post('/api/courses', upload.array('holeImages'), async (req: Request, res: Response) => {
    const pool = mysql.createPool(dbConfig);
    const connection = await pool.getConnection();
    try {
        const { name, location } = req.body;
        const holes = JSON.parse(req.body.holes);
        const files = req.files as Express.Multer.File[];
        const fileMap = new Map(files.map(f => [f.originalname, f.filename]));
        await connection.beginTransaction();
        const [courseResult]: any = await connection.execute('INSERT INTO courses (name, location) VALUES (?, ?)', [name, location]);
        const newCourseId = courseResult.insertId;
        for (const holeData of holes) {
            const originalFileName = `hole_${holeData.holeNumber}`;
            const savedFileName = fileMap.get(originalFileName);
            const imageUrl = savedFileName ? `/uploads/${savedFileName}` : null;
            const [holeResult]: any = await connection.execute(
                'INSERT INTO holes (courseId, holeNumber, par, aerialImageUrl) VALUES (?, ?, ?, ?)',
                [newCourseId, holeData.holeNumber, holeData.par, imageUrl]
            );
            const newHoleId = holeResult.insertId;
            for (const teeColor in holeData.tees) {
                const yardage = holeData.tees[teeColor];
                if (yardage > 0) {
                    await connection.execute('INSERT INTO tees (holeId, color, yardage) VALUES (?, ?, ?)', [newHoleId, teeColor, yardage]);
                }
            }
        }
        await connection.commit();
        res.status(201).json({ id: newCourseId, name, location });
    } catch (error) {
        await connection.rollback();
        console.error('Erro ao criar campo completo:', error);
        res.status(500).json({ error: 'Erro ao criar o campo no banco de dados' });
    } finally {
        connection.release();
        pool.end();
    }
});
app.delete('/api/courses/:id', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const connection = await mysql.createConnection(dbConfig);
        await connection.execute('DELETE FROM courses WHERE id = ?', [id]);
        await connection.end();
        res.status(200).json({ message: 'Campo apagado com sucesso.' });
    } catch (error) {
        console.error('Erro ao apagar campo:', error);
        if ((error as any).code === 'ER_ROW_IS_REFERENCED_2') {
            return res.status(400).json({ error: 'Não pode apagar este campo, pois ele está a ser usado por um ou mais torneios.' });
        }
        res.status(500).json({ error: 'Erro ao apagar campo.' });
    }
});

// --- ROTAS PARA TORNEIOS (TOURNAMENTS) ---
// backend/src/server.ts -> Rota GET /api/tournaments ATUALIZADA

app.get('/api/tournaments', async (req: Request, res: Response) => {
    try {
        const { status } = req.query; // Pega o parâmetro opcional 'status'
        const connection = await mysql.createConnection(dbConfig);
        
        let query = `
            SELECT t.id, t.name, t.date, t.status, c.name AS courseName
            FROM tournaments t
            LEFT JOIN courses c ON t.courseId = c.id
        `;
        const params: string[] = [];

        // Se o status for fornecido na URL (ex: /api/tournaments?status=active), adiciona o filtro
        if (status) {
            query += ' WHERE t.status = ?';
            params.push(status as string);
        }

        query += ' ORDER BY t.date DESC';
        
        const [rows] = await connection.execute(query, params);
        await connection.end();
        res.json(rows);
    } catch (error) {
        console.error('Erro ao buscar torneios:', error);
        res.status(500).json({ error: 'Erro ao buscar torneios' });
    }
});
app.post('/api/tournaments', async (req: Request, res: Response) => {
    try {
        const { name, date, courseId, startTime } = req.body;
        if (!name || !date || !courseId) {
        return res.status(400).json({ error: 'Nome, data e campo são obrigatórios.' });
        }
        const connection = await mysql.createConnection(dbConfig);
        const query = 'INSERT INTO tournaments (name, date, courseId, startTime) VALUES (?, ?, ?, ?)';
        const [result]: any = await connection.execute(query, [name, date, courseId, startTime || null]);
        await connection.end();
        res.status(201).json({ id: result.insertId, ...req.body });
    } catch (error) {
        console.error('Erro ao criar torneio:', error);
        res.status(500).json({ error: 'Erro ao criar torneio' });
    }
});
app.delete('/api/tournaments/:id', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const connection = await mysql.createConnection(dbConfig);
        await connection.execute('DELETE FROM tournaments WHERE id = ?', [id]);
        await connection.end();
        res.status(200).json({ message: 'Torneio apagado com sucesso.' });
    } catch (error) {
        console.error('Erro ao apagar torneio:', error);
        res.status(500).json({ error: 'Erro ao apagar torneio.' });
    }
});
app.post('/api/tournaments/:id/finish', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const connection = await mysql.createConnection(dbConfig);
        await connection.execute("UPDATE tournaments SET status = 'completed' WHERE id = ?", [id]);
        await connection.end();
        res.status(200).json({ message: 'Torneio finalizado com sucesso!' });
    } catch (error) {
        console.error('Erro ao finalizar torneio:', error);
        res.status(500).json({ error: 'Erro ao finalizar torneio.' });
    }
});
app.get('/api/tournaments/:tournamentId/tees', async (req: Request, res: Response) => {
    try {
        const { tournamentId } = req.params;
        const connection = await mysql.createConnection(dbConfig);
        const [rows] = await connection.execute(`
            SELECT DISTINCT t.color
            FROM tees t
            JOIN holes h ON t.holeId = h.id
            JOIN courses c ON h.courseId = c.id
            JOIN tournaments tour ON c.id = tour.courseId
            WHERE tour.id = ?
        `, [tournamentId]);
        await connection.end();
        res.json(rows);
    } catch (error) {
        console.error('Erro ao buscar tees do torneio:', error);
        res.status(500).json({ error: 'Erro ao buscar tees.' });
    }
});
app.get('/api/tournaments/:tournamentId/export-groups', async (req: Request, res: Response) => {
    try {
        const { tournamentId } = req.params;
        const connection = await mysql.createConnection(dbConfig);

        const [tournamentRows]: any[] = await connection.execute('SELECT name, date, startTime FROM tournaments WHERE id = ?', [tournamentId]);
        if (tournamentRows.length === 0) {
            await connection.end();
            return res.status(404).json({ error: 'Torneio não encontrado.' });
        }
        const tournament = tournamentRows[0];
        const TEE_TIME_INTERVAL = 10;

        const [groupRows]: any[] = await connection.execute(`
            SELECT g.id as groupId, g.startHole, g.accessCode, p.fullName
            FROM \`groups\` g
            JOIN group_players gp ON g.id = gp.groupId
            JOIN players p ON gp.playerId = p.id
            WHERE g.tournamentId = ?
            ORDER BY g.startHole, g.id, p.fullName;
        `, [tournamentId]);
        
        await connection.end();

        if (groupRows.length === 0) {
            return res.status(404).json({ error: 'Nenhum grupo encontrado para este torneio.' });
        }

        const groupsByHole = groupRows.reduce((acc, row) => {
            const { startHole, groupId, ...playerData } = row;
            if (!acc[startHole]) acc[startHole] = new Map();
            if (!acc[startHole].has(groupId)) {
                acc[startHole].set(groupId, { ...playerData, players: [] });
            }
            acc[startHole].get(groupId).players.push(playerData.fullName);
            return acc;
        }, {} as Record<string, Map<number, any>>);

        const workbook = new ExcelJS.Workbook();
        workbook.creator = 'Birdify';
        const sheet = workbook.addWorksheet('Horários de Saída');

        sheet.mergeCells('A1:D1');
        const titleCell = sheet.getCell('A1');
        titleCell.value = tournament.name.toUpperCase();
        titleCell.font = { name: 'Calibri', size: 16, bold: true };
        titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
        
        let currentRow = 3;

        for (const hole in groupsByHole) {
            const groups = Array.from(groupsByHole[hole].values());
            
            sheet.mergeCells(`A${currentRow}:D${currentRow}`);
            const teeTitleCell = sheet.getCell(`A${currentRow}`);
            teeTitleCell.value = `HORÁRIO DE SAÍDA - TEE ${hole}`;
            teeTitleCell.font = { name: 'Calibri', size: 12, bold: true, color: { argb: 'FFFFFFFF' } };
            teeTitleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F81BD' } };
            teeTitleCell.alignment = { vertical: 'middle', horizontal: 'center' };
            currentRow++;
            
            const headerRow = sheet.addRow(['HORA', 'MATCH', 'JOGADORES', 'CÓDIGO']);
            headerRow.font = { bold: true };
            headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
            currentRow++;

            let matchNumber = 1;
            let teeTime = new Date(`${tournament.date.toISOString().split('T')[0]}T${tournament.startTime || '08:00:00'}`);

            groups.forEach(group => {
                const formattedTime = teeTime.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
                const startRow = currentRow;
                group.players.forEach((playerName: string, index: number) => {
                    if (index === 0) {
                        sheet.addRow([formattedTime, matchNumber, playerName, group.accessCode]);
                    } else {
                        sheet.addRow(['', '', playerName, '']);
                    }
                });
                const endRow = currentRow + group.players.length - 1;

                if (group.players.length > 1) {
                    sheet.mergeCells(`A${startRow}:A${endRow}`);
                    sheet.mergeCells(`B${startRow}:B${endRow}`);
                    sheet.mergeCells(`D${startRow}:D${endRow}`);
                }
                
                sheet.getCell(`A${startRow}`).alignment = { vertical: 'middle', horizontal: 'center' };
                sheet.getCell(`B${startRow}`).alignment = { vertical: 'middle', horizontal: 'center' };
                sheet.getCell(`D${startRow}`).alignment = { vertical: 'middle', horizontal: 'center' };

                currentRow = endRow + 1;
                matchNumber++;
                teeTime.setMinutes(teeTime.getMinutes() + TEE_TIME_INTERVAL);
            });
            currentRow++;
        }

        sheet.columns.forEach(column => {
            if (column.key === 'players') column.width = 40;
            else if (column.key === 'code') column.width = 15;
            else column.width = 12;
        });

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=' + 'Horarios_de_Saida.xlsx');
        await workbook.xlsx.write(res);
        res.end();

    } catch (error) {
        console.error('Erro ao exportar grupos:', error);
        res.status(500).json({ error: 'Erro ao exportar grupos.' });
    }
});

// --- ROTAS PARA JOGADORES (PLAYERS) ---
app.get('/api/players', async (req: Request, res: Response) => {
    try {
        const { tournamentId } = req.query;
        const connection = await mysql.createConnection(dbConfig);
        let query = 'SELECT * FROM players';
        let params: any[] = [];
        if (tournamentId) {
            query += `
                WHERE id NOT IN (
                    SELECT gp.playerId FROM group_players gp
                    JOIN \`groups\` g ON gp.groupId = g.id
                    WHERE g.tournamentId = ?
                )
            `;
            params.push(tournamentId);
        }
        query += ' ORDER BY fullName';
        const [rows] = await connection.execute(query, params);
        await connection.end();
        res.json(rows);
    } catch (error) {
        console.error('Erro ao buscar jogadores:', error);
        res.status(500).json({ error: 'Erro ao buscar jogadores' });
    }
});
app.post('/api/players', async (req: Request, res: Response) => {
    try {
        const { fullName, cpf, email, password, gender } = req.body;
        if (!fullName || !cpf || !email || !password || !gender) {
            return res.status(400).json({ error: 'Todos os campos são obrigatórios.' });
        }
        const connection = await mysql.createConnection(dbConfig);
        const query = 'INSERT INTO players (fullName, cpf, email, password, gender) VALUES (?, ?, ?, ?, ?)';
        const [result]: any = await connection.execute(query, [fullName, cpf, email, password, gender]);
        await connection.end();
        res.status(201).json({ id: result.insertId, ...req.body });
    } catch (error: any) {
        console.error('Erro ao cadastrar jogador:', error);
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ error: 'O Email ou CPF fornecido já está em uso.' });
        }
        res.status(500).json({ error: 'Erro ao cadastrar jogador.' });
    }
});

// --- ROTAS PARA GRUPOS (GROUPS) ---
app.get('/api/tournaments/:tournamentId/groups', async (req: Request, res: Response) => {
    try {
        const { tournamentId } = req.params;
        const connection = await mysql.createConnection(dbConfig);
        const [groups]: any[] = await connection.execute('SELECT * FROM `groups` WHERE tournamentId = ?', [tournamentId]);
        for (const group of groups) {
            const [players] = await connection.execute(`
                SELECT p.fullName, gp.isResponsible
                FROM group_players gp
                JOIN players p ON gp.playerId = p.id
                WHERE gp.groupId = ?
            `, [group.id]);
            group.players = players;
        }
        await connection.end();
        res.json(groups);
    } catch (error) {
        console.error('Erro ao buscar grupos:', error);
        res.status(500).json({ error: 'Erro ao buscar grupos do torneio' });
    }
});
app.post('/api/groups', async (req: Request, res: Response) => {
    const pool = mysql.createPool(dbConfig);
    const connection = await pool.getConnection();
    try {
        const { tournamentId, startHole, players, responsiblePlayerId, category } = req.body;
        const accessCode = Math.random().toString(36).substring(2, 8).toUpperCase();
        
        await connection.beginTransaction();
        const [groupResult]: any = await connection.execute(
        'INSERT INTO `groups` (tournamentId, startHole, accessCode, category) VALUES (?, ?, ?, ?)',
        [tournamentId, startHole, accessCode, category]
        );
        const newGroupId = groupResult.insertId;
        for (const player of players) {
            await connection.execute(
                'INSERT INTO group_players (groupId, playerId, isResponsible, teeColor) VALUES (?, ?, ?, ?)',
                [newGroupId, player.id, player.id === responsiblePlayerId, player.teeColor]
            );
        }
        await connection.commit();
        res.status(201).json({ message: 'Grupo criado com sucesso!', accessCode });
    } catch (error) {
        await connection.rollback();
        console.error('Erro ao criar grupo:', error);
        res.status(500).json({ error: 'Erro ao criar o grupo' });
    } finally {
        connection.release();
        pool.end();
    }
});
app.delete('/api/groups/:id', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const connection = await mysql.createConnection(dbConfig);
        await connection.execute('DELETE FROM `groups` WHERE id = ?', [id]);
        await connection.end();
        res.status(200).json({ message: 'Grupo apagado com sucesso.' });
    } catch (error) {
        console.error('Erro ao apagar grupo:', error);
        res.status(500).json({ error: 'Erro ao apagar grupo.' });
    }
});
app.post('/api/groups/handicaps', async (req: Request, res: Response) => {
    try {
        const { groupId, handicaps } = req.body;
        if (!groupId || !handicaps) {
            return res.status(400).json({ error: 'Dados incompletos.' });
        }
        const connection = await mysql.createConnection(dbConfig);
        for (const playerId in handicaps) {
            const courseHandicap = handicaps[playerId];
            await connection.execute(
                'UPDATE group_players SET courseHandicap = ? WHERE groupId = ? AND playerId = ?',
                [courseHandicap, groupId, playerId]
            );
        }
        await connection.end();
        res.status(200).json({ message: 'Handicaps atualizados com sucesso.' });
    } catch (error) {
        console.error('Erro ao atualizar handicaps:', error);
        res.status(500).json({ error: 'Erro ao atualizar handicaps.' });
    }
});
app.post('/api/groups/finish', async (req: Request, res: Response) => {
    try {
        const { groupId } = req.body;
        if (!groupId) {
            return res.status(400).json({ error: 'ID do grupo é obrigatório.' });
        }
        const connection = await mysql.createConnection(dbConfig);
        await connection.execute("UPDATE `groups` SET status = 'completed' WHERE id = ?", [groupId]);
        await connection.end();
        res.status(200).json({ message: 'Rodada finalizada com sucesso!' });
    } catch (error) {
        console.error('Erro ao finalizar rodada:', error);
        res.status(500).json({ error: 'Erro ao finalizar rodada.' });
    }
});

// --- ROTAS DE AUTENTICAÇÃO E SCORECARD ---
app.post('/api/login', async (req: Request, res: Response) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
        return res.status(400).json({ error: 'Email e senha são obrigatórios.' });
        }
        const connection = await mysql.createConnection(dbConfig);
        const query = 'SELECT id, fullName, email, cpf, role, gender FROM players WHERE email = ? AND password = ?';
        const [rows]: any[] = await connection.execute(query, [email, password]);
        await connection.end();
        if (rows.length > 0) {
        const user = rows[0];
        res.status(200).json({ user });
        } else {
        res.status(401).json({ error: 'Email ou senha inválidos.' });
        }
    } catch (error) {
        console.error('Erro no login:', error);
        res.status(500).json({ error: 'Erro interno no servidor.' });
    }
});
app.get('/api/scorecard/:accessCode', async (req: Request, res: Response) => {
    try {
        const { accessCode } = req.params;
        const connection = await mysql.createConnection(dbConfig);
        const [groupDetails]: any[] = await connection.execute(`
            SELECT g.id as groupId, g.startHole, g.status, t.id as tournamentId, t.name as tournamentName, c.name as courseName, c.id as courseId
            FROM \`groups\` g
            JOIN tournaments t ON g.tournamentId = t.id
            JOIN courses c ON t.courseId = c.id
            WHERE g.accessCode = ?
        `, [accessCode]);
        if (groupDetails.length === 0) return res.status(404).json({ error: 'Código de acesso inválido.' });
        const group = groupDetails[0];
        const [players] = await connection.execute(`
            SELECT p.id, p.fullName, gp.teeColor
            FROM group_players gp
            JOIN players p ON gp.playerId = p.id
            WHERE gp.groupId = ?
        `, [group.groupId]);
        group.players = players;
        const [scores] = await connection.execute('SELECT playerId, holeNumber, strokes FROM scores WHERE groupId = ?', [group.groupId]);
        group.scores = scores;
        const [holes]: any[] = await connection.execute('SELECT id, courseId, holeNumber, par, aerialImageUrl FROM holes WHERE courseId = ? ORDER BY holeNumber', [group.courseId]);
        for (const hole of holes) {
            const [tees] = await connection.execute('SELECT * FROM tees WHERE holeId = ?', [hole.id]);
            hole.tees = tees;
        }
        group.holes = holes;
        
        await connection.end();
        res.json(group);
    } catch (error) {
        console.error('Erro ao buscar dados do scorecard:', error);
        res.status(500).json({ error: 'Erro ao buscar dados do scorecard.' });
    }
});
app.post('/api/scores/hole', async (req: Request, res: Response) => {
    const { groupId, holeNumber, scores } = req.body;
    if (!groupId || !holeNumber || !scores) {
        return res.status(400).json({ error: 'Dados incompletos.' });
    }
    const pool = mysql.createPool(dbConfig);
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        for (const score of scores) {
            const query = `
                INSERT INTO scores (groupId, playerId, holeNumber, strokes)
                VALUES (?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE strokes = ?
            `;
            await connection.execute(query, [groupId, score.playerId, holeNumber, score.strokes, score.strokes]);
        }
        await connection.commit();
        res.status(200).json({ message: 'Pontuações do buraco salvas com sucesso.' });
    } catch (error) {
        await connection.rollback();
        console.error('Erro ao salvar pontuações do buraco:', error);
        res.status(500).json({ error: 'Erro ao salvar pontuações.' });
    } finally {
        connection.release();
        pool.end();
    }
});

// --- ROTAS DE LEADERBOARD E HISTÓRICO ---
app.get('/api/leaderboard/:tournamentId', async (req: Request, res: Response) => {
    try {
        const { tournamentId } = req.params;
        const connection = await mysql.createConnection(dbConfig);
        const [players]: any[] = await connection.execute(`
            SELECT p.id, p.fullName, p.gender, gp.courseHandicap, g.id as groupId
            FROM players p
            JOIN group_players gp ON p.id = gp.playerId
            JOIN \`groups\` g ON gp.groupId = g.id
            WHERE g.tournamentId = ?
        `, [tournamentId]);
        interface Hole { holeNumber: number; par: number; }
        const [holes] = await connection.execute(`
            SELECT h.holeNumber, h.par FROM holes h
            JOIN courses c ON h.courseId = c.id
            JOIN tournaments t ON c.id = t.courseId
            WHERE t.id = ? ORDER BY h.holeNumber
        `, [tournamentId]);
        
        const parMap = new Map((holes as {holeNumber: number, par: number}[]).map(h => [h.holeNumber, h.par]));
        for (const player of players) {
            const [scores] = await connection.execute('SELECT holeNumber, strokes FROM scores WHERE playerId = ? AND groupId = ?', [player.id, player.groupId]);
            const typedScores = scores as {holeNumber: number, strokes: number}[];
            player.grossTotal = typedScores.reduce((sum, score) => sum + score.strokes, 0);
            let toPar = 0;
            for (const score of typedScores) {
                toPar += (score.strokes - (parMap.get(score.holeNumber) || 0));
            }
            player.toPar = toPar;
            player.netToPar = toPar - (player.courseHandicap || 0);
            player.through = typedScores.length;
        }
        const typedPlayers = players as any[];
        typedPlayers.sort((a, b) => a.netToPar - b.netToPar);
        let rank = 1;
        for (let i = 0; i < typedPlayers.length; i++) {
            if (i > 0 && typedPlayers[i].netToPar > typedPlayers[i-1].netToPar) {
                rank = i + 1;
            }
            typedPlayers[i].rank = rank;
        }
        await connection.end();
        res.json(typedPlayers);
    } catch (error) {
        console.error('Erro ao calcular leaderboard:', error);
        res.status(500).json({ error: 'Erro ao calcular leaderboard.' });
    }
});
app.get('/api/history/player/:playerId', async (req: Request, res: Response) => {
    try {
        const { playerId } = req.params;
        const connection = await mysql.createConnection(dbConfig);
        const [tournaments] = await connection.execute(`
            SELECT DISTINCT t.id, t.name, t.date, c.name as courseName
            FROM tournaments t
            JOIN \`groups\` g ON t.id = g.tournamentId
            JOIN group_players gp ON g.id = gp.groupId
            JOIN courses c ON t.courseId = c.id
            WHERE gp.playerId = ? AND t.status = 'completed'
            ORDER BY t.date DESC
        `, [playerId]);
        await connection.end();
        res.json(tournaments);
    } catch (error) {
        console.error('Erro ao buscar histórico do jogador:', error);
        res.status(500).json({ error: 'Erro ao buscar histórico.' });
    }
});
app.get('/api/history/player/:playerId/tournament/:tournamentId', async (req: Request, res: Response) => {
    try {
        const { playerId, tournamentId } = req.params;
        const connection = await mysql.createConnection(dbConfig);
        const [results]: any[] = await connection.execute(`
            SELECT 
                s.holeNumber, 
                s.strokes, 
                h.par,
                tee.yardage
            FROM scores s
            JOIN \`groups\` g ON s.groupId = g.id
            JOIN holes h ON s.holeNumber = h.holeNumber
            JOIN tournaments t ON g.tournamentId = t.id
            JOIN group_players gp ON g.id = gp.groupId AND s.playerId = gp.playerId
            LEFT JOIN tees tee ON h.id = tee.holeId AND gp.teeColor = tee.color
            WHERE s.playerId = ? AND g.tournamentId = ? AND t.courseId = h.courseId
            ORDER BY s.holeNumber
        `, [playerId, tournamentId]);
        await connection.end();
        res.json(results);
    } catch (error) {
        console.error('Erro ao buscar detalhes do torneio do jogador:', error);
        res.status(500).json({ error: 'Erro ao buscar detalhes do torneio.' });
    }
});

// --- ROTA DE EXPORTAÇÃO EXCEL ---
app.get('/api/tournaments/:tournamentId/export', async (req: Request, res: Response) => {
    try {
        const { tournamentId } = req.params;
        const connection = await mysql.createConnection(dbConfig);
        
        const [players]: any[] = await connection.execute(`
            SELECT 
                p.id, p.fullName, p.gender, 
                gp.courseHandicap,
                s.holeNumber, s.strokes
            FROM players p
            JOIN group_players gp ON p.id = gp.playerId
            JOIN \`groups\` g ON gp.groupId = g.id
            LEFT JOIN scores s ON gp.playerId = s.playerId AND gp.groupId = s.groupId
            WHERE g.tournamentId = ?
            ORDER BY p.fullName, s.holeNumber
        `, [tournamentId]);

        if (players.length === 0) {
            await connection.end();
            return res.status(404).send('Nenhum jogador encontrado para este torneio.');
        }

        const playerData = new Map();
        for (const row of players) {
            if (!playerData.has(row.id)) {
                playerData.set(row.id, {
                    id: row.id,
                    name: row.fullName,
                    gender: row.gender,
                    handicap: row.courseHandicap || 0,
                    scores: new Map(),
                    tiebreakApplied: ''
                });
            }
            if (row.holeNumber) {
                playerData.get(row.id).scores.set(row.holeNumber, row.strokes);
            }
        }

        const processedPlayers = Array.from(playerData.values());

        for (const player of processedPlayers) {
            player.gross = 0;
            for (let i = 1; i <= 18; i++) {
                player.gross += player.scores.get(i) || 0;
            }
            player.net = player.gross - player.handicap;
        }

        const calculateTiebreakScore = (player: any, holes: number[], hcpFraction: number): number => {
            const gross = holes.reduce((sum, holeNum) => sum + (player.scores.get(holeNum) || 0), 0);
            return gross - (player.handicap * hcpFraction);
        };

        const tiebreakCriteria = [
            { holes: [10, 11, 12, 13, 14, 15, 16, 17, 18], hcpFraction: 1/2, description: 'Desempate: Últimos 9' },
            { holes: [13, 14, 15, 16, 17, 18], hcpFraction: 1/3, description: 'Desempate: Últimos 6' },
            { holes: [16, 17, 18], hcpFraction: 1/6, description: 'Desempate: Últimos 3' },
            { holes: [18], hcpFraction: 1/18, description: 'Desempate: Último Buraco' },
            { holes: [1, 2, 3, 4, 5, 6, 7, 8, 9], hcpFraction: 1/2, description: 'Desempate: Primeiros 9' },
            { holes: [4, 5, 6, 7, 8, 9], hcpFraction: 1/3, description: 'Desempate: Primeiros 6' },
            { holes: [7, 8, 9], hcpFraction: 1/6, description: 'Desempate: Primeiros 3' },
            { holes: [9], hcpFraction: 1/18, description: 'Desempate: Buraco 9' },
        ];

        const comparePlayers = (a: any, b: any) => {
            if (a.net !== b.net) {
                return a.net - b.net;
            }
            for (const criterion of tiebreakCriteria) {
                const scoreA = calculateTiebreakScore(a, criterion.holes, criterion.hcpFraction);
                const scoreB = calculateTiebreakScore(b, criterion.holes, criterion.hcpFraction);
                if (Math.abs(scoreA - scoreB) > 0.001) { 
                    if (a.tiebreakApplied === '') a.tiebreakApplied = criterion.description;
                    if (b.tiebreakApplied === '') b.tiebreakApplied = criterion.description;
                    return scoreA - scoreB;
                }
            }
            return 0; 
        };
        
        const netSortedPlayers = [...processedPlayers].sort(comparePlayers);
        const grossSortedPlayers = [...processedPlayers].sort((a, b) => a.gross - b.gross);

        const categories = {
            M1: { name: 'Categoria M1 (0 a 8.5)', gender: 'Male', min: 0, max: 8.5, players: [] as any[] },
            M2: { name: 'Categoria M2 (8.6 a 14)', gender: 'Male', min: 8.6, max: 14.0, players: [] as any[] },
            M3: { name: 'Categoria M3 (14.1 a 22.1)', gender: 'Male', min: 14.1, max: 22.1, players: [] as any[] },
            M4: { name: 'Categoria M4 (22.2 a 36.4)', gender: 'Male', min: 22.2, max: 36.4, players: [] as any[] },
            F1: { name: 'Categoria F1 (0 a 16.0)', gender: 'Female', min: 0, max: 16.0, players: [] as any[] },
            F2: { name: 'Categoria F2 (16.1 a 23.7)', gender: 'Female', min: 16.1, max: 23.7, players: [] as any[] },
            F3: { name: 'Categoria F3 (23.8 a 36.4)', gender: 'Female', min: 23.8, max: 36.4, players: [] as any[] },
        };
        
        for (const player of processedPlayers) {
            for (const catKey in categories) {
                const cat = categories[catKey as keyof typeof categories];
                if (player.gender === cat.gender && player.handicap >= cat.min && player.handicap <= cat.max) {
                    cat.players.push(player);
                    break;
                }
            }
        }

        for (const catKey in categories) {
            categories[catKey as keyof typeof categories].players.sort(comparePlayers);
        }
        
        await connection.end();

        const workbook = new ExcelJS.Workbook();
        workbook.creator = 'Birdify';

        const addDetailedSheet = (sheetName: string, players: any[], includeTiebreakCol: boolean) => {
            const sheet = workbook.addWorksheet(sheetName);
            const columns: Partial<ExcelJS.Column>[] = [
                { header: 'Pos.', key: 'pos', width: 5 },
                { header: 'Nome', key: 'name', width: 30 },
                { header: 'HDC', key: 'handicap', width: 8 },
            ];
            for (let i = 1; i <= 9; i++) columns.push({ header: `B${i}`, key: `h${i}`, width: 5 });
            columns.push({ header: '1ª Volta', key: 'ida', width: 8 });
            for (let i = 10; i <= 18; i++) columns.push({ header: `B${i}`, key: `h${i}`, width: 5 });
            columns.push({ header: '2ª Volta', key: 'volta', width: 8 });
            columns.push({ header: 'GROSS', key: 'gross', width: 8 });
            columns.push({ header: 'NET', key: 'net', width: 8 });
            
            if (includeTiebreakCol) {
                 columns.push({ header: 'Desempate Aplicado', key: 'tiebreak', width: 20 });
            }
            sheet.columns = columns;

            players.forEach((p, i) => {
                const rowData: any = { pos: i + 1, name: p.name, handicap: p.handicap };
                let ida = 0, volta = 0;
                for (let h = 1; h <= 18; h++) {
                    const score = p.scores.get(h) || 0;
                    rowData[`h${h}`] = score;
                    if (h <= 9) ida += score;
                    else volta += score;
                }
                rowData.ida = ida;
                rowData.volta = volta;
                rowData.gross = p.gross;
                rowData.net = p.net;
                if (includeTiebreakCol) {
                    rowData.tiebreak = p.tiebreakApplied;
                }
                sheet.addRow(rowData);
            });
        };

        addDetailedSheet('Leaderboard Geral (NET)', netSortedPlayers, true);

        const grossSheet = workbook.addWorksheet('Campeões Gross');
        grossSheet.columns = [
             { header: 'Pos.', key: 'pos', width: 5 },
             { header: 'Nome', key: 'name', width: 30 },
             { header: 'GROSS', key: 'gross', width: 10 },
        ];
        grossSortedPlayers.forEach((p, i) => {
            grossSheet.addRow({ pos: i + 1, name: p.name, gross: p.gross });
        });

        for (const catKey in categories) {
            const cat = categories[catKey as keyof typeof categories];
            if (cat.players.length > 0) {
                addDetailedSheet(catKey, cat.players, true);
            }
        }
        
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=' + 'Relatorio_Torneio_Detalhado.xlsx');
        await workbook.xlsx.write(res);
        res.end();

    } catch (error) {
        console.error('Erro ao exportar relatório:', error);
        res.status(500).json({ error: 'Erro ao exportar relatório.' });
    }
});

// --- NOVA ROTA PARA ESTATÍSTICAS DO JOGADOR ---
app.get('/api/players/:playerId/stats', async (req: Request, res: Response) => {
    try {
        const { playerId } = req.params;
        const connection = await mysql.createConnection(dbConfig);

        const query = `
            SELECT
                COUNT(DISTINCT t.id) as totalRounds,
                AVG(s.strokes) as averageStrokes,
                MIN(player_round_scores.gross) as bestGross,
                MIN(player_round_scores.gross - gp.courseHandicap) as bestNet,
                
                SUM(CASE WHEN s.strokes <= h.par - 2 THEN 1 ELSE 0 END) as eaglesOrBetter,
                SUM(CASE WHEN s.strokes = h.par - 1 THEN 1 ELSE 0 END) as birdies,
                SUM(CASE WHEN s.strokes = h.par THEN 1 ELSE 0 END) as pars,
                SUM(CASE WHEN s.strokes = h.par + 1 THEN 1 ELSE 0 END) as bogeys,
                SUM(CASE WHEN s.strokes >= h.par + 2 THEN 1 ELSE 0 END) as doubleBogeysOrWorse,

                AVG(CASE WHEN h.par = 3 THEN s.strokes ELSE NULL END) as averagePar3,
                AVG(CASE WHEN h.par = 4 THEN s.strokes ELSE NULL END) as averagePar4,
                AVG(CASE WHEN h.par = 5 THEN s.strokes ELSE NULL END) as averagePar5
            FROM players p
            JOIN group_players gp ON p.id = gp.playerId
            JOIN \`groups\` g ON gp.groupId = g.id
            JOIN tournaments t ON g.tournamentId = t.id
            JOIN scores s ON gp.playerId = s.playerId AND gp.groupId = s.groupId
            JOIN courses c ON t.courseId = c.id
            JOIN holes h ON c.id = h.courseId AND s.holeNumber = h.holeNumber
            LEFT JOIN (
                SELECT 
                    s_inner.playerId, 
                    g_inner.tournamentId, 
                    SUM(s_inner.strokes) as gross
                FROM scores s_inner
                JOIN \`groups\` g_inner ON s_inner.groupId = g_inner.id
                GROUP BY s_inner.playerId, g_inner.tournamentId
            ) as player_round_scores ON s.playerId = player_round_scores.playerId AND t.id = player_round_scores.tournamentId
            WHERE 
                p.id = ? AND t.status = 'completed'
            GROUP BY
                p.id;
        `;

        const [rows]: any[] = await connection.execute(query, [playerId]);
        await connection.end();

        if (rows.length > 0) {
            const stats = rows[0];
            // Converte valores para números e formata, tratando nulos
            for (const key in stats) {
                if (stats[key] === null) {
                    stats[key] = 0;
                } else if (typeof stats[key] === 'string') {
                    stats[key] = parseFloat(parseFloat(stats[key]).toFixed(2));
                }
            }
            res.json(stats);
        } else {
            // Retorna um objeto zerado se o jogador não tiver estatísticas
            res.json({
                totalRounds: 0,
                averageStrokes: 0,
                bestGross: 0,
                bestNet: 0,
                eaglesOrBetter: 0,
                birdies: 0,
                pars: 0,
                bogeys: 0,
                doubleBogeysOrWorse: 0,
                averagePar3: 0,
                averagePar4: 0,
                averagePar5: 0,
            });
        }
    } catch (error) {
        console.error('Erro ao buscar estatísticas do jogador:', error);
        res.status(500).json({ error: 'Erro ao buscar estatísticas.' });
    }
});

app.listen(port, () => {
  console.log(`🚀 Servidor backend rodando em http://localhost:${port}`);
});