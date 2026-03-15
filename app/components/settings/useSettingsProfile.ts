import { useEffect, useState } from "react";

type MessageState = { type: "success" | "error"; text: string } | null;

type UseSettingsProfileOptions = {
  currentUser: any;
  queryClient: any;
  updateUsernameMutation: any;
  updateStatusMutation: any;
  updateBioMutation: any;
  updateAvatarMutation: any;
  updateBannerMutation: any;
  setMessage: (message: MessageState) => void;
};

export function useSettingsProfile({
  currentUser,
  queryClient,
  updateUsernameMutation,
  updateStatusMutation,
  updateBioMutation,
  updateAvatarMutation,
  updateBannerMutation,
  setMessage,
}: UseSettingsProfileOptions) {
  const [userStatus, setUserStatus] = useState<"online" | "offline" | "idle" | "afk" | "dnd">("online");
  const [userBio, setUserBio] = useState("");
  const [bioInputValue, setBioInputValue] = useState("");
  const [hasBioChanged, setHasBioChanged] = useState(false);
  const [newUsername, setNewUsername] = useState("");
  const [bannerPreview, setBannerPreview] = useState<string | null>(null);
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isCroppingModalOpen, setIsCroppingModalOpen] = useState(false);
  const [croppingImageType, setCroppingImageType] = useState<"avatar" | "banner" | null>(null);
  const [croppingImageSrc, setCroppingImageSrc] = useState<string | null>(null);
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);

  useEffect(() => {
    if (currentUser?.status) {
      setUserStatus(currentUser.status as "online" | "offline" | "idle" | "afk" | "dnd");
    }
    setUserBio(currentUser?.about || "");
    setBioInputValue(currentUser?.about || "");
  }, [currentUser]);

  const resolvedCurrentStatus: "online" | "offline" | "idle" | "afk" | "dnd" =
    (currentUser?.status as "online" | "offline" | "idle" | "afk" | "dnd") || "online";
  const hasUsernameChanged = Boolean(newUsername.trim()) && newUsername.trim() !== (currentUser?.username || "");
  const hasBannerChanged = Boolean(bannerFile || bannerPreview) && bannerPreview !== currentUser?.banner_url;
  const hasProfileChanges = hasUsernameChanged || hasBannerChanged || hasBioChanged || userStatus !== resolvedCurrentStatus;

  const handleUsernameSubmit = async (e: { preventDefault: () => void }) => {
    e.preventDefault();
    if (!newUsername.trim() || updateUsernameMutation.isPending) {
      return;
    }

    const originalData = currentUser;
    if (currentUser) {
      queryClient.setQueryData(["user", "profile", "current"], {
        ...currentUser,
        username: newUsername.trim(),
      });
    }

    try {
      await updateUsernameMutation.mutateAsync(newUsername);
      setMessage({ type: "success", text: "Username updated successfully!" });
      setNewUsername("");
    } catch {
      if (originalData) {
        queryClient.setQueryData(["user", "profile", "current"], originalData);
      }
      setMessage({ type: "error", text: "Failed to update username" });
    }
  };

  const handleStatusSubmit = async () => {
    if (updateStatusMutation.isPending) {
      return;
    }

    const originalStatus = currentUser?.status;
    if (currentUser) {
      queryClient.setQueryData(["user", "profile", "current"], {
        ...currentUser,
        status: userStatus,
      });
    }

    try {
      await updateStatusMutation.mutateAsync(userStatus);
      setMessage({ type: "success", text: "Status updated successfully!" });
    } catch {
      if (currentUser && originalStatus) {
        queryClient.setQueryData(["user", "profile", "current"], {
          ...currentUser,
          status: originalStatus,
        });
      }
      setMessage({ type: "error", text: "Failed to update status" });
    }
  };

  const handleBioChange = async () => {
    if (updateBioMutation.isPending || !hasBioChanged) {
      return;
    }

    const originalBio = currentUser?.about;
    if (currentUser) {
      queryClient.setQueryData(["user", "profile", "current"], {
        ...currentUser,
        about: bioInputValue,
      });
    }

    try {
      await updateBioMutation.mutateAsync(bioInputValue);
      setMessage({ type: "success", text: "Bio updated successfully!" });
      setHasBioChanged(false);
    } catch {
      if (currentUser && originalBio !== undefined) {
        queryClient.setQueryData(["user", "profile", "current"], {
          ...currentUser,
          about: originalBio,
        });
      }
      setMessage({ type: "error", text: "Failed to update bio" });
    }
  };

  const isGifFile = (file: File) => file.type.toLowerCase() === "image/gif" || /\.gif$/i.test(file.name);

  const handleAvatarFileSubmit = async (file: File) => {
    if (isGifFile(file)) {
      try {
        await updateAvatarMutation.mutateAsync(file);
        setMessage({ type: "success", text: "Animated GIF avatar updated successfully!" });
      } catch {
        setMessage({ type: "error", text: "Failed to update avatar" });
      }
      return;
    }

    setSelectedImageFile(file);
    setCroppingImageType("avatar");
    setCroppingImageSrc(URL.createObjectURL(file));
    setIsCroppingModalOpen(true);
  };

  const handleAvatarUrlSubmit = async (url: string) => {
    if (!url.trim() || updateAvatarMutation.isPending) {
      return;
    }

    try {
      await updateAvatarMutation.mutateAsync(url);
      setMessage({ type: "success", text: "Avatar updated successfully!" });
    } catch {
      setMessage({ type: "error", text: "Failed to update avatar" });
    }
  };

  const handleBannerFileSubmit = async (file: File) => {
    if (isGifFile(file)) {
      setBannerFile(file);
      setBannerPreview(URL.createObjectURL(file));
      setMessage({
        type: "success",
        text: "Animated GIF banner selected. Click Save Changes to apply it.",
      });
      return;
    }

    setSelectedImageFile(file);
    setCroppingImageType("banner");
    setCroppingImageSrc(URL.createObjectURL(file));
    setIsCroppingModalOpen(true);
  };

  const handleBannerUrlSubmit = async (url: string) => {
    if (!url.trim() || updateBannerMutation.isPending) {
      return;
    }

    setBannerPreview(url.trim());
  };

  const handleCroppedImage = async (croppedBlob: Blob) => {
    if (!croppingImageType) {
      return;
    }

    const file = new File([croppedBlob], `${croppingImageType}.jpg`, {
      type: "image/jpeg",
      lastModified: Date.now(),
    });

    if (croppingImageType === "avatar") {
      try {
        await updateAvatarMutation.mutateAsync(file);
        setMessage({ type: "success", text: "Avatar updated successfully!" });
      } catch {
        setMessage({ type: "error", text: "Failed to update avatar" });
      }
    } else {
      setBannerFile(file);
      setBannerPreview(URL.createObjectURL(file));
      setMessage({ type: "success", text: "Banner updated successfully!" });
    }

    setIsCroppingModalOpen(false);
    setCroppingImageSrc(null);
    setSelectedImageFile(null);
    setCroppingImageType(null);
  };

  const handleCroppingCancel = () => {
    setIsCroppingModalOpen(false);
    setCroppingImageSrc(null);
    setSelectedImageFile(null);
    setCroppingImageType(null);
  };

  const resetProfileForm = () => {
    setNewUsername("");
    setBioInputValue(currentUser?.about || "");
    setUserBio(currentUser?.about || "");
    setUserStatus(resolvedCurrentStatus);
    setHasBioChanged(false);
    setBannerFile(null);
    setBannerPreview(null);
  };

  const saveProfileChanges = async () => {
    if (hasUsernameChanged && !updateUsernameMutation.isPending) {
      await handleUsernameSubmit({ preventDefault() {} });
    }

    if (hasBannerChanged) {
      try {
        if (bannerFile) {
          await updateBannerMutation.mutateAsync(bannerFile);
        } else if (bannerPreview && !bannerPreview.startsWith("blob:")) {
          await updateBannerMutation.mutateAsync(bannerPreview);
        }
        setMessage({ type: "success", text: "Banner updated successfully!" });
        setBannerPreview(null);
        setBannerFile(null);
      } catch {
        setMessage({ type: "error", text: "Failed to update banner" });
      }
    }

    if (hasBioChanged && !updateBioMutation.isPending) {
      await handleBioChange();
    }

    if (userStatus !== resolvedCurrentStatus && !updateStatusMutation.isPending) {
      await handleStatusSubmit();
    }
  };

  return {
    userStatus,
    setUserStatus,
    userBio,
    setUserBio,
    bioInputValue,
    setBioInputValue,
    hasBioChanged,
    setHasBioChanged,
    newUsername,
    setNewUsername,
    bannerPreview,
    setBannerPreview,
    bannerFile,
    setBannerFile,
    isProfileModalOpen,
    setIsProfileModalOpen,
    isCroppingModalOpen,
    croppingImageType,
    croppingImageSrc,
    selectedImageFile,
    resolvedCurrentStatus,
    hasUsernameChanged,
    hasBannerChanged,
    hasProfileChanges,
    handleUsernameSubmit,
    handleStatusSubmit,
    handleBioChange,
    handleAvatarFileSubmit,
    handleAvatarUrlSubmit,
    handleBannerFileSubmit,
    handleBannerUrlSubmit,
    handleCroppedImage,
    handleCroppingCancel,
    resetProfileForm,
    saveProfileChanges,
  };
}
