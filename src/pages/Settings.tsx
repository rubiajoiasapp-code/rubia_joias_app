import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Settings as SettingsIcon, Bell, Clock, Calendar, MessageSquare, Save, Send, AlertCircle } from 'lucide-react';

interface NotificationSettings {
    id?: string;
    whatsapp_numero: string;
    callmebot_api_key: string;
    horario_envio: string;
    dias_antecedencia: number[];
    ativo: boolean;
    enviar_finais_semana: boolean;
}

const Settings: React.FC = () => {
    const [settings, setSettings] = useState<NotificationSettings>({
        whatsapp_numero: '',
        callmebot_api_key: '',
        horario_envio: '10:00',
        dias_antecedencia: [3, 2, 0],
        ativo: false,
        enviar_finais_semana: false,
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [testing, setTesting] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    useEffect(() => {
        fetchSettings();
    }, []);

    const fetchSettings = async () => {
        try {
            const { data, error } = await supabase
                .from('configuracoes_notificacoes')
                .select('*')
                .maybeSingle();

            if (error) throw error;

            if (data) {
                setSettings({
                    id: data.id,
                    whatsapp_numero: data.whatsapp_numero,
                    callmebot_api_key: data.callmebot_api_key,
                    horario_envio: data.horario_envio,
                    dias_antecedencia: data.dias_antecedencia,
                    ativo: data.ativo,
                    enviar_finais_semana: data.enviar_finais_semana,
                });
            }
        } catch (error) {
            console.error('Error fetching settings:', error);
            showMessage('error', 'Erro ao carregar configurações');
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        setMessage(null);

        try {
            if (settings.id) {
                // Update existing
                const { error } = await supabase
                    .from('configuracoes_notificacoes')
                    .update({
                        whatsapp_numero: settings.whatsapp_numero,
                        callmebot_api_key: settings.callmebot_api_key,
                        horario_envio: settings.horario_envio,
                        dias_antecedencia: settings.dias_antecedencia,
                        ativo: settings.ativo,
                        enviar_finais_semana: settings.enviar_finais_semana,
                    })
                    .eq('id', settings.id);

                if (error) throw error;
            } else {
                // Insert new
                const { error } = await supabase
                    .from('configuracoes_notificacoes')
                    .insert([settings]);

                if (error) throw error;
            }

            showMessage('success', 'Configurações salvas com sucesso!');
            fetchSettings();
        } catch (error: any) {
            console.error('Error saving settings:', error);
            showMessage('error', 'Erro ao salvar configurações: ' + error.message);
        } finally {
            setSaving(false);
        }
    };

    const handleTestSend = async () => {
        setTesting(true);
        setMessage(null);

        try {
            const mensagem = `🔔 *TESTE DE NOTIFICAÇÃO*\n\nOlá! Este é um teste do sistema de lembretes automáticos da Rubia Joias.\n\nSe você recebeu esta mensagem, sua configuração está correta! ✅\n\n---\n_Mensagem enviada em ${new Date().toLocaleString('pt-BR')}_`;

            const encodedMessage = encodeURIComponent(mensagem);
            const url = `https://api.callmebot.com/whatsapp.php?phone=${settings.whatsapp_numero}&text=${encodedMessage}&apikey=${settings.callmebot_api_key}`;

            const response = await fetch(url);
            const responseText = await response.text();

            if (!response.ok) {
                throw new Error(responseText);
            }

            showMessage('success', 'Mensagem de teste enviada! Verifique seu WhatsApp.');
        } catch (error: any) {
            console.error('Error sending test:', error);
            showMessage('error', 'Erro ao enviar mensagem de teste: ' + error.message);
        } finally {
            setTesting(false);
        }
    };

    const showMessage = (type: 'success' | 'error', text: string) => {
        setMessage({ type, text });
        setTimeout(() => setMessage(null), 5000);
    };

    const toggleDiaAntecedencia = (dia: number) => {
        setSettings(prev => ({
            ...prev,
            dias_antecedencia: prev.dias_antecedencia.includes(dia)
                ? prev.dias_antecedencia.filter(d => d !== dia)
                : [...prev.dias_antecedencia, dia].sort((a, b) => b - a)
        }));
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-96">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-pink-600 mx-auto mb-4"></div>
                    <p className="text-gray-600">Carregando configurações...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold text-gray-800 flex items-center">
                    <SettingsIcon className="w-8 h-8 mr-3 text-pink-600" />
                    Configurações
                </h1>
                <p className="text-gray-600 mt-1">Gerencie as configurações do sistema</p>
            </div>

            {/* Message Alert */}
            {message && (
                <div className={`p-4 rounded-xl border ${message.type === 'success'
                    ? 'bg-green-50 border-green-200 text-green-800'
                    : 'bg-red-50 border-red-200 text-red-800'
                    }`}>
                    <p className="flex items-center">
                        <AlertCircle className="w-5 h-5 mr-2" />
                        {message.text}
                    </p>
                </div>
            )}

            {/* WhatsApp Notifications Card */}
            <div className="bg-white rounded-2xl shadow-lg p-6">
                <div className="flex items-center mb-6">
                    <div className="p-3 bg-green-100 rounded-xl mr-4">
                        <MessageSquare className="w-6 h-6 text-green-600" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-gray-800">Lembretes via WhatsApp</h2>
                        <p className="text-sm text-gray-600">Configure os alertas automáticos usando CallMeBot</p>
                    </div>
                </div>

                {/* Instructions */}
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
                    <h3 className="font-semibold text-blue-900 mb-2">📱 Como obter sua API Key do CallMeBot:</h3>
                    <ol className="list-decimal list-inside space-y-1 text-sm text-blue-800">
                        <li>Adicione o número <strong>+34 644 44 89 77</strong> aos seus contatos do WhatsApp</li>
                        <li>Envie a mensagem: <strong>"I allow callmebot to send me messages"</strong></li>
                        <li>Aguarde a resposta com sua API Key (pode levar alguns minutos)</li>
                        <li>Cole a API Key recebida no campo abaixo</li>
                    </ol>
                </div>

                {/* Form */}
                <div className="space-y-6">
                    {/* WhatsApp Number */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Número WhatsApp (com DDI)
                        </label>
                        <input
                            type="text"
                            value={settings.whatsapp_numero}
                            onChange={(e) => setSettings({ ...settings, whatsapp_numero: e.target.value })}
                            placeholder="5511999999999"
                            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                        />
                        <p className="text-xs text-gray-500 mt-1">Exemplo: 5511999999999 (Brasil = 55 + DDD + Número)</p>
                    </div>

                    {/* API Key */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            CallMeBot API Key
                        </label>
                        <input
                            type="text"
                            value={settings.callmebot_api_key}
                            onChange={(e) => setSettings({ ...settings, callmebot_api_key: e.target.value })}
                            placeholder="123456"
                            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                        />
                        <p className="text-xs text-gray-500 mt-1">Chave fornecida pelo CallMeBot via WhatsApp</p>
                    </div>

                    {/* Horário de Envio */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
                            <Clock className="w-4 h-4 mr-2" />
                            Horário de Envio Diário
                        </label>
                        <input
                            type="time"
                            value={settings.horario_envio}
                            onChange={(e) => setSettings({ ...settings, horario_envio: e.target.value })}
                            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                        />
                    </div>

                    {/* Dias de Antecedência */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-3 flex items-center">
                            <Calendar className="w-4 h-4 mr-2" />
                            Alertar com Antecedência de:
                        </label>
                        <div className="grid grid-cols-3 gap-4">
                            {[3, 2, 0].map(dia => (
                                <button
                                    key={dia}
                                    type="button"
                                    onClick={() => toggleDiaAntecedencia(dia)}
                                    className={`px-4 py-3 rounded-xl border-2 font-medium transition-all ${settings.dias_antecedencia.includes(dia)
                                        ? 'bg-pink-600 text-white border-pink-600'
                                        : 'bg-white text-gray-700 border-gray-300 hover:border-pink-400'
                                        }`}
                                >
                                    {dia === 0 ? 'No dia' : `${dia} dias antes`}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Toggles */}
                    <div className="space-y-4 pt-4 border-t">
                        {/* Ativo */}
                        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                            <div className="flex items-center">
                                <Bell className="w-5 h-5 text-gray-600 mr-3" />
                                <div>
                                    <p className="font-medium text-gray-800">Ativar Lembretes Automáticos</p>
                                    <p className="text-sm text-gray-500">Enviar notificações diariamente</p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setSettings({ ...settings, ativo: !settings.ativo })}
                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${settings.ativo ? 'bg-pink-600' : 'bg-gray-300'
                                    }`}
                            >
                                <span
                                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${settings.ativo ? 'translate-x-6' : 'translate-x-1'
                                        }`}
                                />
                            </button>
                        </div>

                        {/* Finais de Semana */}
                        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                            <div className="flex items-center">
                                <Calendar className="w-5 h-5 text-gray-600 mr-3" />
                                <div>
                                    <p className="font-medium text-gray-800">Enviar em Finais de Semana</p>
                                    <p className="text-sm text-gray-500">Incluir sábados e domingos</p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setSettings({ ...settings, enviar_finais_semana: !settings.enviar_finais_semana })}
                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${settings.enviar_finais_semana ? 'bg-pink-600' : 'bg-gray-300'
                                    }`}
                            >
                                <span
                                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${settings.enviar_finais_semana ? 'translate-x-6' : 'translate-x-1'
                                        }`}
                                />
                            </button>
                        </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex flex-col sm:flex-row gap-3 pt-6">
                        <button
                            onClick={handleSave}
                            disabled={saving}
                            className="flex-1 bg-pink-600 text-white px-6 py-3 rounded-xl font-medium hover:bg-pink-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                        >
                            <Save className="w-5 h-5 mr-2" />
                            {saving ? 'Salvando...' : 'Salvar Configurações'}
                        </button>
                        <button
                            onClick={handleTestSend}
                            disabled={testing || !settings.whatsapp_numero || !settings.callmebot_api_key}
                            className="flex-1 bg-green-600 text-white px-6 py-3 rounded-xl font-medium hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                        >
                            <Send className="w-5 h-5 mr-2" />
                            {testing ? 'Enviando...' : 'Testar Envio'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Settings;
