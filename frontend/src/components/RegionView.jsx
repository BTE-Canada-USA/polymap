/*+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 + RegionView.jsx                                                             +
 +                                                                            +
 + Copyright (c) 2022 Robin Ferch                                             +
 + https://robinferch.me                                                      +
 + This project is released under the MIT license.                            +
 +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++*/

import React, {useEffect, useState} from 'react';
import {
    Accordion,
    ActionIcon,
    Alert,
    Box,
    Button,
    Code,
    Drawer,
    Group,
    Loader,
    Radio,
    ScrollArea,
    Table,
    Text,
    Tooltip
} from "@mantine/core";
import axios from "axios";
import {useClipboard} from "@mantine/hooks";
import {centerOfMass, polygon} from "@turf/turf";
import StatCard from "./StatCard";
import NewStatCard from "./StatCard";
import {FaCity} from "react-icons/fa";
import {BiArea} from "react-icons/bi";
import {AiFillDelete, AiOutlineDelete, AiOutlineLink} from "react-icons/ai";
import {MdAdd, MdOutlineShareLocation} from "react-icons/md";
import {useModals} from "@mantine/modals";
import {showNotification} from "@mantine/notifications";
import {useKeycloak} from "@react-keycloak-fork/web";
import {FiLock} from "react-icons/fi";
import {useUser} from "../hooks/useUser";
import {IoMdFlag} from "react-icons/io";
import ReportDialog from "./ReportDialog";
import {Link} from "react-router-dom";
import RegionImageView from "./RegionImageView";
import {BsFillPersonFill} from "react-icons/bs";
import {HiUserGroup} from "react-icons/hi";
import AdditionalBuildersDialog from "./AdditionalBuildersDialog";
import {GiPartyPopper, TbFence} from "react-icons/all";

const RegionView = ({data, open, setOpen, setUpdateMap}) => {

    if (!data) return null;

    const modals = useModals();
    const [loading, setLoading] = useState(true);
    const clipboard = useClipboard({timeout: 800});
    const [center, setCenter] = useState([0, 0]);
    const [region, setRegion] = useState(null);
    const [editing, setEditing] = useState(false);
    const [plotType, setPlotType] = useState("normal");

    const {keycloak} = useKeycloak();
    const isAdmin = keycloak?.tokenParsed?.realm_access.roles.includes("mapadmin");

    const user = useUser();

    const numberWithCommas = (x) => {
        return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    };

    useEffect(() => {
        setLoading(true);
        getData();
    }, [data]);

    const getData = async () => {
        if (!data?.id) return;
        const region = await axios.get(`/api/v1/region/${data.id}`);
        if (region.data.isEventRegion) {
            setPlotType('event');
        }
        else if (region.data.isPlotRegion) {
            setPlotType('plot');
        }
        else if (!region.data.isPlotRegion && !region.data.isEventRegion) {
            setPlotType('normal');
        }

        setRegion(region.data);
        let coords = JSON.parse(region.data.data);
        coords.push(coords[0]);
        let poly = polygon([coords]);
        let centerMass = centerOfMass(poly);
        setCenter(centerMass.geometry.coordinates);
        setLoading(false);
    };

    const copyId = (id) => {
        clipboard.copy(id);
    };

    const copyCoords = (coords) => {
        clipboard.copy(coords[0] + "," + coords[1]);
    };

    const copyLink = (id) => {
        clipboard.copy(window.location.origin + "?region=" + id + "&details=true");
    };

    const showDeleteConfirmation = () => {
        setOpen(false);
        modals.openConfirmModal({
            title: 'Delete this region?',
            centered: true,
            children: (
                <Text size="sm">
                    Are you sure you want to delete this region? <b>This process is irreversible.</b>
                </Text>
            ),
            labels: {confirm: 'Delete region', cancel: "No don't delete it"},
            confirmProps: {color: 'red'},
            onCancel: () => setOpen(true),
            onConfirm: () => {
                deleteRegion(region.id);
            },
        });
    };

    const openReportModal = () => {
        if (!keycloak.authenticated) {
            showNotification({
                title: 'You need to be logged in!',
                message: 'You need to be logged in to report a region.',
                color: "red"
            });
            return;
        }
        if (region.ownerID === user?.data?.id) {
            showNotification({
                title: 'Ehhhhh...',
                message: 'You are not able to report your own region, you dummie.',
                color: "red"
            });
            return;
        }
        setOpen(false);
        modals.openModal({
            title: 'Report this region',
            centered: true,
            children: (
                <ReportDialog regionId={region.id} keycloak={keycloak} />
            ),
        });
    };

    const teleportToRegion = async () => {
        await axios.post(`/api/v1/user/teleport`, {coords: center}, {headers: {authorization: "Bearer " + keycloak.token}});
        showNotification({
            title: 'Teleport to region',
            message: 'You will be teleported shortly.',
            color: "green"
        });
    };

    const deleteRegion = async (id) => {
        await axios.delete(`/api/v1/region/${id}`, {headers: {authorization: "Bearer " + keycloak.token}});
        showNotification({
            title: 'Region deleted!',
            message: 'This region has been deleted.',
            color: "red"
        });
        setUpdateMap(true);
    };

    const openAdditionalBuilderModal = () => {
        if (!keycloak.authenticated) {
            showNotification({
                title: 'You need to be logged in!',
                message: 'You need to be logged in to report a region.',
                color: "red"
            });
            return;
        }
        if (region.ownerID !== user?.data?.id) {
            showNotification({
                title: 'Ehhhhh...',
                message: 'You are not the owner of this region.',
                color: "red"
            });
            return;
        }
        setOpen(false);
        modals.openModal({
            title: 'Add Additional Builder',
            centered: true,
            onClose: () => {
                setOpen(true);
                getData();
            },
            children: (
                <AdditionalBuildersDialog regionId={region.id} keycloak={keycloak} />
            ),
        });
    };

    const onSave = async () => {
        const city = document.getElementById('city').value;
        const owner = document.getElementById('owner')?.value;
        try {
            const {data: mcApiData} = await axios.get(`https://playerdb.co/api/player/minecraft/${owner}`);
            console.log(mcApiData);
            const params = {
                city: city,
                player_id: mcApiData.data.player.id,
                username: mcApiData.data.player.username,
                isEventRegion: plotType === 'event',
                isPlotRegion: plotType === 'plot',
            };
            await axios.post(`api/v1/region/${data.id}/edit`, params, {headers: {authorization: "Bearer " + keycloak.token}});
        } catch (error) {
            alert("User does not exist! Error: " + error);
            return;
        }
        setEditing(false);
        setLoading(true);
        setUpdateMap(true);
        getData();
    };

    return (
        <Drawer
            opened={open}
            onClose={() => setOpen(false)}
            title={`Region Info`}
            padding="xl"
            size="xl"
            overlayBlur={3}>
            {loading ?
                <Box sx={{
                    height: "90%",
                    width: "100%",
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center"
                }}>
                    <Loader mt={"xl"} />
                </Box>
                :
                <Box>
                    <RegionImageView />

                    <Group spacing={"md"} cols={1}>
                        {!region.isEventRegion && !region.isPlotRegion ?
                            <StatCard title={"Owner"}
                                innerImage={`https://crafatar.com/avatars/${data.userUUID}?size=64`}
                                value={data.username} Icon={BsFillPersonFill} subtitle={""} editable={editing}
                                id={"owner"} />
                            : null
                        }

                        {region.isEventRegion ?
                            <Alert icon={<GiPartyPopper size={16} />} sx={{width: "100%"}} title="Event Region"
                                color="red">
                                This is an Event Region, which was built as part of a Build Team Event. Therefore, it
                                has no owner.
                            </Alert>
                            : null
                        }

                        {region.isPlotRegion ?
                            <Alert icon={<TbFence size={16} />} sx={{width: "100%"}} title="Plot Region"
                                color="green">
                                This is a plot region. Therefore, it has no owner.
                            </Alert>
                            : null
                        }

                        {region?.additionalBuilder?.length > 0 && !(region.ownerID === user?.data?.id) ?
                            <StatCard title={"Additional Builders"} noBigValue={true}
                                value={<AdditionalBuilders showEditButtons={false}
                                    openAdditionalBuilderModal={openAdditionalBuilderModal}
                                    region={region} update={getData} />}
                                Icon={HiUserGroup}
                                subtitle={""} />
                            : null
                        }

                        {(region.ownerID === user?.data?.id) ?
                            <StatCard title={"Additional Builders"} noBigValue={true}
                                value={<AdditionalBuilders showEditButtons={true}
                                    openAdditionalBuilderModal={openAdditionalBuilderModal}
                                    region={region} update={getData}
                                />}
                                Icon={HiUserGroup}
                                subtitle={""} />
                            : null
                        }

                        {editing ?
                            <Radio.Group name="type" label="Regions Typ"
                                value={plotType}
                                onChange={setPlotType}
                            >
                                <Radio value="normal" label="Normal" />
                                <Radio value="event" label="Event" />
                                <Radio value="plot" label="Plot" />
                            </Radio.Group>
                            : null
                        }

                        <StatCard title={"City"} value={region?.city} Icon={FaCity} subtitle={""} editable={editing}
                            id={"city"} />
                        <StatCard title={"Area"} value={numberWithCommas(region?.area) + " m²"} Icon={BiArea}
                            subtitle={""} />
                    </Group>


                    {keycloak?.authenticated ?
                        <Group spacing={"md"} cols={2} grow mt={"md"}>
                            {(region.ownerID === user?.data?.id) || isAdmin ?
                                <Button color={"red"} leftIcon={<AiFillDelete />} onClick={showDeleteConfirmation}>Delete
                                    Region</Button>
                                : null
                            }
                            {user?.data?.minecraftUUID ?
                                <Button color={"blue"} leftIcon={<MdOutlineShareLocation />} onClick={teleportToRegion}>Teleport
                                    here</Button>
                                : null
                            }

                            {!user?.data?.minecraftUUID ?
                                <Button color={"blue"} leftIcon={<MdOutlineShareLocation />} component={Link}
                                    to={"/link"}>Teleport
                                    here</Button>
                                : null
                            }
                        </Group>
                        :
                        <Button leftIcon={<FiLock size={14} />} fullWidth mt={"md"}
                            onClick={() => keycloak.login({redirectUri: window.location.origin + "?region=" + region.id + "&details=true"})}>Login
                            to get more features</Button>
                    }

                    {isAdmin && !editing ?
                        <Button fullWidth mt={"md"} onClick={() => setEditing(true)}>Edit the values</Button> : null}
                    {isAdmin && editing ? <Button fullWidth mt={"md"} onClick={() => onSave()}>Save</Button> : null}
                    {isAdmin && editing ?
                        <Button fullWidth mt={"md"} onClick={() => setEditing(false)}>Cancel</Button> : null}

                    <Accordion my={"md"}>
                        <Accordion.Item value="info">
                            <Accordion.Control>More information</Accordion.Control>
                            <Accordion.Panel>
                                <Table>
                                    <tbody>
                                        <tr>
                                            <td>ID</td>
                                            <td>
                                                <Tooltip
                                                    label={clipboard.copied ? "Copied" : "Click to copy"}
                                                    position="right"
                                                    color={clipboard.copied ? "green" : "gray"}
                                                    transition="scale"
                                                >
                                                    <Code onClick={() => copyId(data.id)} sx={{
                                                        cursor: "pointer"
                                                    }}>{data.id}</Code>
                                                </Tooltip>
                                            </td>
                                        </tr>
                                        <tr>
                                            <td>Center coordinates</td>
                                            <td>
                                                <Tooltip
                                                    label={clipboard.copied ? "Copied" : "Click to copy"}
                                                    position="right"
                                                    color={clipboard.copied ? "green" : "gray"}
                                                    transition="scale"
                                                >
                                                    <Code onClick={() => copyCoords(center)} sx={{
                                                        cursor: "pointer"
                                                    }}>{center[0]}, {center[1]}</Code>
                                                </Tooltip>
                                            </td>
                                        </tr>
                                    </tbody>
                                </Table>
                            </Accordion.Panel>

                        </Accordion.Item>
                    </Accordion>

                    <Box style={{position: "absolute", bottom: 15, right: 15, display: "flex", gap: "5px"}}>
                        {(!user?.data?.blockedFromReports && !region.isPlotRegion && !region.isEventRegion) ?
                            <Tooltip
                                label="Report this region"
                                position="right">

                                <ActionIcon size="md" variant="light" onClick={openReportModal}>
                                    <IoMdFlag />
                                </ActionIcon>
                            </Tooltip>
                            : null
                        }

                        <Tooltip
                            label={clipboard.copied ? "Copied" : "Copy a link to this region"}
                            position="right"
                            color={clipboard.copied ? "green" : "gray"}
                            ml={"sm"}>

                            <ActionIcon size="md" variant="light" onClick={() => copyLink(region.id)}>
                                <AiOutlineLink />
                            </ActionIcon>
                        </Tooltip>
                    </Box>
                </Box>
            }
        </Drawer>
    );
};

const AdditionalBuilders = ({region, showEditButtons, openAdditionalBuilderModal, update}) => {
    const {keycloak} = useKeycloak();
    const [load, setLoad] = useState(false);
    const removeBuilder = (builder) => {
        setLoad(true);
        axios.delete(`/api/v1/region/${region.id}/additionalBuilder/${builder}`, {headers: {authorization: "Bearer " + keycloak.token}})
            .then(() => {
                showNotification({
                    title: 'Success',
                    message: 'Builder removed',
                    color: "green"
                });
                update();
                setLoad(false);
            })
            .catch((e) => {
                showNotification({
                    title: 'Failed',
                    message: 'An unexpected error occurred.',
                    color: "red"
                });
                setLoad(false);
            });
    };

    return (
        <div style={{width: "100%"}}>
            {
                region.additionalBuilder &&
                <Box sx={{width: "100%"}}>
                    {
                        region.additionalBuilder.map((builder, idx) => {
                            return (
                                <Box sx={{display: "flex", justifyContent: "space-between", width: "100%"}}>
                                    <Box id={idx} sx={{display: "flex", gap: "10px", alignItems: "center"}}>
                                        <img src={`https://crafatar.com/avatars/${builder.minecraftUUID}?size=20`}
                                            alt=""
                                            width={20} height={20} />
                                        <Text sx={{fontWeight: "bold"}}>{builder.username}</Text>
                                    </Box>
                                    {
                                        showEditButtons &&
                                        <ActionIcon onClick={() => removeBuilder(builder.id)} loading={load}>
                                            <AiOutlineDelete />
                                        </ActionIcon>
                                    }

                                </Box>
                            );
                        })
                    }
                </Box>
            }

            {
                showEditButtons &&
                <Button color={"blue"} mt={"md"} leftIcon={<MdAdd />} onClick={openAdditionalBuilderModal}>
                    Add Additional Builder
                </Button>
            }
        </div>
    );

};

export {RegionView};
